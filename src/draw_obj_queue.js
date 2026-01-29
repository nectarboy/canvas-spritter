import MakeCircularPoolConstructor from './circular_pool.js';

const MAX_DRAWOBJS = 20000;

// An entry in the buffer that holds a buffered DrawObj and the index to its buffered data
class DrawObjHolder {
    constructor() {
        this.drawObj = null;
        this.drawObjDataIndex = 0;
        this.priority = 0;
    }

    Reset() {
        this.drawObj = null;
    }
}

class MaskPoint {
    constructor(priority, mask) {
        this.priority = priority;
        this.mask = mask;
    }
}

class Pass {
    constructor(holderStart, holderEnd, stencilReference) {
        this.holderStart = holderStart;
        this.holderEnd = holderEnd;
        this.stencilReference = stencilReference;
        this.opaqueVerticesStart = 0;
        this.opaqueVertices = 0;
        this.transparentVerticesStart = 0;
        this.transparentVertices = 0;
    };
}

// Responsible for buffering 
class DrawObjQueue {
    constructor(spritter) {
        this.spritter = spritter;

        // TODO: one big heap that includes the buffered holders' drawObjData as well as the final drawObjData stage?
        // MDN: "If the source array is a typed array, the two arrays may share the same underlying ArrayBuffer; the JavaScript engine will intelligently copy the source range of the buffer to the destination range."

        this.holderPool = new (MakeCircularPoolConstructor(DrawObjHolder, MAX_DRAWOBJS))();

        this.maskHolders = [];
        this.holders = [];

        this.maskPoints = [];
        this.passes = [];
        this.maskVertices = 0;

        // DrawObj storage buffer
        this.storageBufferSize = 4096 * 1024;
        this.storageStage = new Float32Array(this.storageBufferSize);
        this.storageStage_Uint32 = new Uint32Array(this.storageStage.buffer);
        this.storageBuffer = spritter.device.createBuffer({
            size: this.storageStage.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.drawObjDataCount = 0;
        this.drawObjDataEntrySize = 64;
        this.drawObjDataEntryByteSize = this.drawObjDataEntrySize * this.storageStage.BYTES_PER_ELEMENT;

        this.storageBindGroupLayout = spritter.device.createBindGroupLayout({
            label: 'draw_obj_queue bind group layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'read-only-storage',
                        minBindingSize: this.storageStage.byteLength,
                    },
                }
            ]
        });
        this.storageBindGroup = spritter.device.createBindGroup({
            label: 'draw_obj_queue bind group',
            layout: this.storageBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.storageBuffer }
                }
            ]
        });

        // Vertex buffer
        this.vertexBufferSize = 4096 * 1024;
        this.verticesStage = new Float32Array(this.vertexBufferSize);
        this.verticesStage_Uint32 = new Uint32Array(this.verticesStage.buffer);
        this.vertexBuffer = spritter.device.createBuffer({
            size: this.verticesStage.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.verticesCount = 0;
        this.vertexBufferEntrySize = 7;
        this.vertexBufferEntryByteSize = this.vertexBufferEntrySize * this.verticesStage.BYTES_PER_ELEMENT;

        // Index buffer
        this.indexBufferSize = 4096 * 1024;
        this.indexStage = new Uint32Array(this.indexBufferSize);
        this.indexBuffer = spritter.device.createBuffer({
            size: this.indexStage.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        });

        this.vertexBufferDescriptor = {
            arrayStride: this.vertexBufferEntryByteSize,
            attributes: [
                {
                    shaderLocation: 0,
                    offset: 0,
                    format: 'float32x2'
                },
                {
                    shaderLocation: 1,
                    offset: 4 * 2,
                    format: 'float32x4'
                },
                {
                    shaderLocation: 2,
                    offset: 4 * 6,
                    format: 'uint32'
                },
            ]
        };
    }

    BufferDrawobj(drawObj, priority) {
        if (this.holders.length === MAX_DRAWOBJS) {
            console.warn("Drawobj queue full, cannot buffer drawobj.");
            return;
        }

        let holder = this.holderPool.Get();
        holder.drawObj = drawObj;
        holder.drawObjDataIndex = this.drawObjDataCount;
        this.BufferDrawObjData(drawObj.data);
        holder.priority = priority;
        this.holders.push(holder);
    }

    BufferDrawobjAsMask(drawObj, mask) {
        if (mask === 0) {
            return;
        }
        
        if (this.holders.length === MAX_DRAWOBJS) {
            console.warn("Drawobj queue full, cannot buffer drawobj.");
            return;
        }

        let holder = this.holderPool.Get();
        holder.drawObj = drawObj;
        holder.drawObjDataIndex = this.drawObjDataCount;
        this.BufferDrawObjData(drawObj.data);
        holder.priority = 0; // omit
        this.maskHolders.push(holder);
    }

    MaskDrawobjsFromPriority(priority, mask) {
        this.maskPoints.push(new MaskPoint(priority, mask)); // currently does not support overlapping
    }

    BufferDrawObjData(data) {
        this.storageStage.set(data, this.drawObjDataCount++ * this.drawObjDataEntrySize);
    }

    PepperDrawObjDataWithOrdering(index, ordering) {
        this.storageStage[index * this.drawObjDataEntrySize + 60] = ordering;
    }

    PushDrawObjsToStageBuffers() {
        let ordering = 0;

        for (let i = 0; i < this.maskHolders.length; i++) {
            let holder = this.maskHolders[i];
            holder.drawObj.BufferVerticesAt(this, holder, holder.drawObjDataIndex);
        }
        this.maskVertices = this.verticesCount;

        const comparer = (a, b) => a.priority - b.priority;
        this.holders.sort(comparer);

        if (this.maskPoints.length === 0) {
            this.passes.push(new Pass(0, this.holders.length - 1, 0));
        }
        else {
            const maskPointComparer = (a, b) => a.priority - b.priority;
            this.maskPoints.sort(maskPointComparer);

            let start = 0;
            let mask = 0;
            let pointI = 0;
            let point = this.maskPoints[0];
            for (let i = 0; i < this.holders.length; i++) {
                let holder = this.holders[i];
                if (holder.priority >= point.priority) {
                    if (mask !== point.mask) {
                        if (i > start) {
                            this.passes.push(new Pass(start, i - 1, mask));
                        }
                        mask = point.mask;
                        start = i;
                    }
                    pointI++;
                    if (pointI === this.maskPoints.length) {
                        this.passes.push(new Pass(start, this.holders.length - 1, mask));
                        break;
                    }
                    point = this.maskPoints[pointI];
                }
            }

            if (this.passes.length === 0) 
                this.passes.push(new Pass(start, this.holders.length - 1, mask));
            else
                this.passes[this.passes.length - 1].holderEnd = this.holders.length - 1;
        }

        for (let i = 0; i < this.passes.length; i++) {
            let pass = this.passes[i];

            let opaques = [];
            let transparents = [];

            for (let i = pass.holderStart; i <= pass.holderEnd; i++) {
                this.PepperDrawObjDataWithOrdering(this.holders[i].drawObjDataIndex, ordering++);

                let isOpaque = (!this.holders[i].drawObj.transparent) | (this.holders[i].drawObj.IsFullyOpaque());
                (isOpaque ? opaques : transparents).push(this.holders[i]);
            }

            // Opaque (Front to back)
            pass.opaqueVerticesStart = this.verticesCount;
            for (let i = 0; i < opaques.length; i++) {
                let holder = opaques[opaques.length - i - 1];
                holder.drawObj.BufferVerticesAt(this, holder, holder.drawObjDataIndex);
            }
            pass.opaqueVertices = this.verticesCount - pass.opaqueVerticesStart;

            // Transparent (Back to front)
            pass.transparentVerticesStart = this.verticesCount;
            for (let i = 0; i < transparents.length; i++) {
                let holder = transparents[i];
                holder.drawObj.BufferVerticesAt(this, holder, holder.drawObjDataIndex);
            }
            pass.transparentVertices = this.verticesCount - pass.transparentVerticesStart;
        }
    }

    EncodeRenderPassCommands(passEncoder) {
        passEncoder.setBindGroup(0, this.spritter.textureManager.bindGroup);
        passEncoder.setBindGroup(1, this.storageBindGroup);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);

        // Draw mask drawobjs
        if (this.maskVertices !== 0) {
            passEncoder.setStencilReference(1); // 1 for now
            passEncoder.setPipeline(this.spritter.stencilSetPipeline);
            passEncoder.draw(this.maskVertices);
        }

        // Draw all drawobjs
        for (let i = 0; i < this.passes.length; i++) {
            let pass = this.passes[i];
            console.log(pass);
            passEncoder.setStencilReference(pass.stencilReference);
            passEncoder.setPipeline(this.spritter.opaquePipeline);
            passEncoder.draw(pass.opaqueVertices, 1, pass.opaqueVerticesStart);
            passEncoder.setPipeline(this.spritter.transparentPipeline);
            passEncoder.draw(pass.transparentVertices, 1, pass.transparentVerticesStart);
        }
        passEncoder.end();
    }

    UploadStageBuffersToBuffers() {
        this.spritter.device.queue.writeBuffer(
            this.vertexBuffer,
            0,
            this.verticesStage.buffer,
            this.verticesStage.byteOffset,
            this.verticesCount * this.vertexBufferEntryByteSize
        );

        // this.spritter.device.queue.writeBuffer(
        //     this.indexBuffer,
        //     0,
        //     this.indexStage.buffer,
        //     this.indexStage.byteOffset,
        //     this.verticesCount
        // );

        this.spritter.device.queue.writeBuffer(
            this.storageBuffer,
            0,
            this.storageStage.buffer,
            this.storageStage.byteOffset,
            this.drawObjDataCount * this.drawObjDataEntryByteSize
        );
    }

    Flush() {
        for (let i = 0; i < this.holders.length; i++) {
            this.holders[i].Reset();
        }
        this.holders.length = 0;
        for (let i = 0; i < this.holders.length; i++) {
            this.maskHolders[i].Reset();
        }
        this.maskHolders.length = 0;
        this.maskPoints.length = 0;
        this.maskVertices = 0;
        this.passes.length = 0;
        this.verticesCount = 0;
        this.drawObjDataCount = 0;
    }
}

export default DrawObjQueue;