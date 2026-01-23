import MakeCircularPoolConstructor from './circular_pool.js';
import Mat3 from './mat3.js';

const MAX_DRAWOBJS = 10000;

// An entry in the buffer that holds a DrawObj and the Mat3 where it will be drawn
class DrawObjHolder {
    constructor() {
        this.drawObj = null;
        this.mat3 = new Mat3();
        this.priority = 0;
        this.orderingThisFrame = 0;
    }

    Reset() {
        this.drawObj = null;
    }
}

const drawObjHolderPool = new (MakeCircularPoolConstructor(DrawObjHolder, MAX_DRAWOBJS))();
console.log(drawObjHolderPool);

// Responsible for buffering 
class DrawObjQueue {
    constructor(spritter) {
        this.spritter = spritter;

        this.holders = [];
        this.opaqueN = 0;
        this.transparentN = 0;
        this.opaqueVertices = 0;
        this.transparentVertices = 0;

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

        // this.opaqueN += !drawObj.transparent;
        // this.transparentN += !!drawObj.transparent;
        let holder = drawObjHolderPool.Get();
        holder.drawObj = drawObj;
        holder.mat3.Set(drawObj.mat3);
        holder.priority = priority;
        this.holders.push(holder);
    }

    PushDrawObjsToStageBuffers() {
        this.holders.sort((a, b) => a.priority - b.priority);

        let opaques = [];
        let transparents = [];

        for (let i = 0; i < this.holders.length; i++) {
            this.holders[i].orderingThisFrame = i;

            let isOpaque = (!this.holders[i].drawObj.transparent) | (this.holders[i].drawObj.IsFullyOpaque());
            (isOpaque ? opaques : transparents).push(this.holders[i]);
        }

        // Opaque (Front to back)
        for (let i = 0; i < opaques.length; i++) {
            let holder = opaques[opaques.length - i - 1];
            holder.drawObj.BufferDataAt(this, holder, holder.orderingThisFrame);
        }
        for (let i = 0; i < opaques.length; i++) {
            let holder = opaques[opaques.length - i - 1];
            holder.drawObj.BufferVerticesAt(this, holder, i);
        }
        this.opaqueVertices = this.verticesCount;

        // Transparent (Back to front)
        for (let i = 0; i < transparents.length; i++) {
            let holder = transparents[i];
            holder.drawObj.BufferDataAt(this, holder, holder.orderingThisFrame);
        }
        for (let i = 0; i < transparents.length; i++) {
            let holder = transparents[i];
            holder.drawObj.BufferVerticesAt(this, holder, i + opaques.length);
        }
        this.transparentVertices = this.verticesCount - this.opaqueVertices;
    }

    UploadStageBuffersToBuffers() {
        this.spritter.device.queue.writeBuffer(
            this.vertexBuffer,
            0,
            this.verticesStage.buffer,
            this.verticesStage.byteOffset,
            this.verticesCount * this.vertexBufferEntryByteSize
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
        this.opaqueN = 0;
        this.transparentN = 0;
        this.opaqueVertices = 0;
        this.transparentVertices = 0;
        this.verticesCount = 0;
        this.drawObjDataCount = 0;
    }
}

export default DrawObjQueue;