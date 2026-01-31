import MakeCircularPoolConstructor from './circular_pool.js';
import { BlockAllocator } from './block_allocators.js';

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
    constructor(priority, mask, isAnti, clear) {
        this.priority = priority;
        this.mask = mask;
        this.isAnti = isAnti;
        this.clear = clear;
    }
}

class Pass {
    constructor(holderStart, holderEnd, maskBits, antiBits) {
        this.holderStart = holderStart;
        this.holderEnd = holderEnd;
        this.maskBits = maskBits;
        this.antiBits = antiBits;
        this.opaquePullerStart = 0;
        this.opaquePullerCount = 0;
        this.transparentPullerStart = 0;
        this.transparentPullerCount = 0;
    };
}

// Responsible for buffering 
class DrawObjQueue {
    constructor(spritter) {
        this.spritter = spritter;

        // TODO: one big heap that includes the buffered holders' drawObjData as well as the final drawObjData stage?
        // MDN: "If the source array is a typed array, the two arrays may share the same underlying ArrayBuffer; the JavaScript engine will intelligently copy the source range of the buffer to the destination range."

        this.holderPool = new (MakeCircularPoolConstructor(DrawObjHolder, MAX_DRAWOBJS))();

        this.usingMasks = false;
        this.maskPoints = [];
        this.maskLayers = [];
        for (let i = 0; i < spritter.maxMaskLayers; i++) {
            this.maskLayers.push({
                holders: [],
                pullerCount: 0
            });
        }
        this.holders = [];
        this.passes = [];
        this.releasedDrawObjQueue = [];
        this.dirtyVertices = [];

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

        // Vertex storage buffer
        this.vertexBufferSize = 4096 * 1024;
        this.vertexStage = new Float32Array(this.vertexBufferSize);
        this.vertexBuffer = spritter.device.createBuffer({
            label: 'vertex buffer',
            size: this.vertexStage.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.vertexEntrySize = 8;
        this.vertexEntryByteSize = this.vertexEntrySize * this.vertexStage.BYTES_PER_ELEMENT;
        this.vertexBlockAllocator = new BlockAllocator(this.vertexStage, this.vertexEntrySize);

        // Puller buffer
        this.pullerBufferSize = 4096 * 1024;
        this.pullerStage = new Uint32Array(this.pullerBufferSize);
        this.pullerBuffer = spritter.device.createBuffer({
            label: 'puller buffer',
            size: this.pullerStage.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.pullerEntrySize = 2;
        this.pullerEntryByteSize = this.pullerEntrySize * this.pullerStage.BYTES_PER_ELEMENT;
        this.pullerCount = 0;

        // Bind groups and descriptors
        this.bindGroupLayout = spritter.device.createBindGroupLayout({
            label: 'DrawObjQueue bind group layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'read-only-storage',
                        minBindingSize: this.storageStage.byteLength,
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: 'read-only-storage',
                        minBindingSize: this.vertexStage.byteLength
                    }
                }
            ]
        });
        this.bindGroup = spritter.device.createBindGroup({
            label: 'DrawObjQueue bind group',
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.storageBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.vertexBuffer }
                }
            ]
        });

        this.pullerBufferDescriptor = {
            arrayStride: this.pullerEntryByteSize,
            attributes: [
                // Vertex index
                {
                    shaderLocation: 0,
                    offset: 4 * 0,
                    format: 'uint32'
                },
                // DrawObj index
                {
                    shaderLocation: 1,
                    offset: 4 * 1,
                    format: 'uint32'
                }
            ]
        };
    }

    QueueReleasedDrawObj(drawObj) {
        this.releasedDrawObjQueue.push(drawObj);
    }

    CleanUpReleasedDrawObjs() {
        for (let i = 0; i < this.releasedDrawObjQueue.length; i++) {
            let drawObj = this.releasedDrawObjQueue[i];
            this.vertexBlockAllocator.Free(drawObj.vertices);
            drawObj.vertices = null;
        }
        this.releasedDrawObjQueue.length = 0;
    }

    MarkDirtyVertices(vertices) {
        for (let i = 0; i < vertices.length; i++) {
            let vertex = vertices[i];
            this.dirtyVertices.push({
                byteOffset: vertex.byteOffset,
                byteLength: vertex.byteLength
            });
        }
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
        if (mask < 0 || mask >= this.spritter.maxMaskLayers) {
            console.warn("Invalid mask layer, cannot buffer drawobj.");
            return;
        }

        if (this.holders.length === MAX_DRAWOBJS) {
            console.warn("Drawobj queue full, cannot buffer drawobj.");
            return;
        }

        this.usingMasks = true;

        let holder = this.holderPool.Get();
        holder.drawObj = drawObj;
        holder.drawObjDataIndex = this.drawObjDataCount;
        this.BufferDrawObjData(drawObj.data);
        holder.priority = 0; // omit
        this.maskLayers[mask].holders.push(holder);
    }

    MaskDrawobjsFromPriority(priority, mask, isAnti = false) {
        if (mask < 0 || mask >= this.spritter.maxMaskLayers) {
            console.warn("Invalid mask layer, cannot apply mask.");
            return;
        }
        this.maskPoints.push(new MaskPoint(priority, mask, isAnti, false));
    }

    UnmaskDrawobjsFromPriority(priority, mask) {
        if (mask < 0 || mask >= this.spritter.maxMaskLayers) {
            console.warn("Invalid mask layer, cannot unapply mask.");
            return;
        }
        this.maskPoints.push(new MaskPoint(priority, mask, false, true));
    }

    MaskDrawobjsAcrossRange(priorityA, priorityB, mask, isAnti = false) {
        if (mask < 0 || mask >= this.spritter.maxMaskLayers) {
            console.warn("Invalid mask layer, cannot apply mask.");
            return;
        }
        this.maskPoints.push(new MaskPoint(priorityA, mask, isAnti, false));
        this.maskPoints.push(new MaskPoint(priorityB, mask, false, true));
    }

    BufferDrawObjData(data) {
        this.storageStage.set(data, this.drawObjDataCount++ * this.drawObjDataEntrySize);
    }

    BufferDrawObjPullers(holder) {
        holder.drawObj.PepperPullersWithDrawObjIndex(holder.drawObjDataIndex);
        this.pullerStage.set(holder.drawObj.pullers, this.pullerCount * this.pullerEntrySize);
        this.pullerCount += holder.drawObj.pullers.length / this.pullerEntrySize;
    }

    PepperDrawObjDataWithOrdering(index, ordering) {
        this.storageStage[index * this.drawObjDataEntrySize + 60] = ordering;
    }

    PushDrawObjsToStageBuffers() {
        let ordering = 0;

        // Buffer mask vertices
        if (this.usingMasks) {
            for (let i = 0; i < this.maskLayers.length; i++) {
                let pullerCount = this.pullerCount;
                for (let ii = 0; ii < this.maskLayers[i].holders.length; ii++) {
                    let holder = this.maskLayers[i].holders[ii];
                    this.BufferDrawObjPullers(holder);
                }
                pullerCount = this.pullerCount - pullerCount;
                this.maskLayers[i].pullerCount = pullerCount;
            }
        }

        const comparer = (a, b) => a.priority - b.priority;
        this.holders.sort(comparer);

        // Define a default normal pass
        if (this.maskPoints.length === 0) {
            this.passes.push(new Pass(0, this.holders.length - 1, 0, 0));
        }
        // Seperate mask boundaries into seperate passes
        else {
            const maskPointComparer = (a, b) => {
                let c1 = a.priority - b.priority;
                return c1 === 0 ? b.clear - a.clear : c1; // clears come before sets
            }
            this.maskPoints.sort(maskPointComparer);

            function PriorityLowerBound(holders, start, priority) {
                let low = start;
                let high = holders.length;

                while (low <= high) {
                    let mid = (low + high) >> 1;

                    if (holders[mid].priority >= priority)
                        high = mid - 1;
                    else
                        low = mid + 1;
                }

                return high + 1;
            }

            let start = 0;
            let maskBits = 0;
            let antiBits = 0;
            for (let i = 0; i < this.maskPoints.length; i++) {
                let point = this.maskPoints[i];
                let index = PriorityLowerBound(this.holders, start, point.priority);
                if (index >= this.holders.length) {
                    break;
                }

                let oldMaskBits = maskBits;
                let oldAntiBits = antiBits;
                if (point.clear) {
                    maskBits &= ~(1 << point.mask);
                }
                else {
                    maskBits |= (1 << point.mask);
                    antiBits &= ~(1 << point.mask);
                    antiBits |= (point.isAnti << point.mask);
                }

                if (maskBits !== oldMaskBits || antiBits !== oldAntiBits) {
                    if (index > start) {
                        this.passes.push(new Pass(start, index - 1, oldMaskBits, oldAntiBits));
                    }
                    start = index < 0 ? 0 : index;
                }
            }

            if (start < this.holders.length - 1)
                this.passes.push(new Pass(start, this.holders.length - 1, maskBits, antiBits)); // top up the remaining pass
        }

        // Buffer vertices of all passes
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
            pass.opaquePullerStart = this.pullerCount;
            for (let i = 0; i < opaques.length; i++) {
                let holder = opaques[opaques.length - i - 1];
                this.BufferDrawObjPullers(holder);
            }
            pass.opaquePullerCount = this.pullerCount - pass.opaquePullerStart;

            // Transparent (Back to front)
            pass.transparentPullerStart = this.pullerCount;
            for (let i = 0; i < transparents.length; i++) {
                let holder = transparents[i];
                this.BufferDrawObjPullers(holder);
            }
            pass.transparentPullerCount = this.pullerCount - pass.transparentPullerStart;
        }
    }

    EncodeRenderPassCommands(passEncoder) {
        passEncoder.setBindGroup(0, this.spritter.textureManager.bindGroup);
        passEncoder.setBindGroup(1, this.bindGroup);
        passEncoder.setVertexBuffer(0, this.pullerBuffer);

        // Draw mask drawobjs
        if (this.usingMasks) {
            let start = 0;
            for (let i = 0; i < this.maskLayers.length; i++) {
                if (this.maskLayers[i].pullerCount === 0) continue;
                passEncoder.setStencilReference(0xffffffff);
                passEncoder.setPipeline(this.spritter.stencilSetPipelines[i]);
                passEncoder.draw(this.maskLayers[i].pullerCount, 1, start);
                start += this.maskLayers[i].pullerCount;
            }
        }

        // Draw all drawobjs
        for (let i = 0; i < this.passes.length; i++) {
            let pass = this.passes[i];
            // console.log(pass);
            passEncoder.setStencilReference(pass.maskBits ^ pass.antiBits);
            if (pass.opaquePullerCount !== 0) {
                passEncoder.setPipeline(this.spritter.GetOpaquePipeline(pass.maskBits));
                passEncoder.draw(pass.opaquePullerCount, 1, pass.opaquePullerStart);
            }
            if (pass.transparentPullerCount !== 0) {
                passEncoder.setPipeline(this.spritter.GetTransparentPipeline(pass.maskBits));
                passEncoder.draw(pass.transparentPullerCount, 1, pass.transparentPullerStart);
            }
        }
        passEncoder.end();
    }

    UploadStageBuffersToBuffers() {
        for (let i = 0; i < this.dirtyVertices.length; i++) {
            let vertex = this.dirtyVertices[i];
            this.spritter.device.queue.writeBuffer(
                this.vertexBuffer,
                vertex.byteOffset,
                this.vertexStage.buffer,
                vertex.byteOffset,
                vertex.byteLength
            );
        }
        // this.spritter.device.queue.writeBuffer(
        //     this.vertexBuffer,
        //     0,
        //     this.vertexStage.buffer,
        //     this.vertexStage.byteOffset,
        //     this.vertexStage.byteLength // TODO: intelligent writing
        // );

        this.spritter.device.queue.writeBuffer(
            this.pullerBuffer,
            0,
            this.pullerStage.buffer,
            this.pullerStage.byteOffset,
            this.pullerCount * this.pullerEntryByteSize
        );

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
        if (this.usingMasks) {
            for (let i = 0; i < this.maskLayers.length; i++) {
                for (let ii = 0; ii < this.maskLayers[i].holders; ii++) {
                    this.maskLayers[i].holders[ii].Reset();
                }
                this.maskLayers[i].holders.length = 0;
                this.maskLayers[i].vertices = 0;
            }
            this.usingMasks = false;
        }
        this.maskPoints.length = 0;
        this.passes.length = 0;

        this.drawObjDataCount = 0;
        this.pullerCount = 0;
        this.CleanUpReleasedDrawObjs();
        this.dirtyVertices.length = 0;
    }
}

export default DrawObjQueue;