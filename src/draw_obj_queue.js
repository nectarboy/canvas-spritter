const MAX_DRAWOBJS = 10000;

class DrawObjHolderList {
    constructor() {
        // DrawObjHolder array
        this.holders = [];
        // used to speed up repeated drawobj buffering with the same priority
        this.lastDrawobjPriority = 0;
        this.lastDrawobjIndex = 0;

        this.largestPriority = 1;
    };

    GetHolderUpperBound(holder) {
        let low = 0;
        let high = this.holders.length - 1;

        while (low <= high) {
            let mid = (low + high) >> 1;
            if (this.holders[mid].priority > holder.priority)
                high = mid - 1;
            else
                low = mid + 1;
        }
        return low;
    }

    BufferDrawobj(drawObj, priority) {
        priority = Math.floor(priority);

        let holder = new DrawObjHolder(drawObj, drawObj.mat3.Copy(), priority); // TODO: We can make this a pool
        if (priority === this.lastDrawobjPriority) {
            this.lastDrawobjIndex++;
        }
        else {
            this.lastDrawobjPriority = priority;
            this.lastDrawobjIndex = this.GetHolderUpperBound(holder);
            if (priority > this.largestPriority) this.largestPriority = priority;
        }
        this.holders.splice(this.lastDrawobjIndex, 0, holder); // Do this or sort once at the end?
    }

    Flush() {
        this.holders.length = 0;
        this.lastDrawobjPriority = 0;
        this.lastDrawobjIndex = 0;
        this.largestPriority = 1;
    }
}

// An entry in the buffer that holds a DrawObj and the Mat3 where it will be drawn
class DrawObjHolder {
    constructor(drawObj, mat3, priority) {
        this.drawObj = drawObj;
        this.mat3 = mat3;
        this.priority = priority;
    }
}

// Responsible for buffering 
class DrawObjQueue {
    constructor(spritter) {
        this.spritter = spritter;

        this.opaqueList = new DrawObjHolderList();
        this.transparentList = new DrawObjHolderList();

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
        if (this.count === MAX_DRAWOBJS) {
            console.warn("Drawobj queue full.");
            return;
        }
        (drawObj.transparent ? this.transparentList : this.opaqueList).BufferDrawobj(drawObj, priority);
    }

    PushDrawObjsToStageBuffers() {
        // Opaque (Front to back)
        const opaqueN = this.opaqueList.holders.length;
        for (let i = 0; i < opaqueN; i++) {
            let holder = this.opaqueList.holders[opaqueN - i - 1];
            holder.drawObj.BufferDataAt(this, holder, i);
        }
        for (let i = 0; i < opaqueN; i++) {
            let holder = this.opaqueList.holders[opaqueN - i - 1];
            holder.drawObj.BufferVerticesAt(this, holder, i);
        }
        this.opaqueVertices = this.verticesCount;

        // Transparent (Back to front)
        const transparentN = this.transparentList.holders.length;
        for (let i = 0; i < transparentN; i++) {
            let holder = this.transparentList.holders[i];
            holder.drawObj.BufferDataAt(this, holder, i + opaqueN);
        }
        for (let i = 0; i < transparentN; i++) {
            let holder = this.transparentList.holders[i];
            holder.drawObj.BufferVerticesAt(this, holder, i + opaqueN);
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
        this.opaqueList.Flush();
        this.transparentList.Flush();
        this.opaqueVertices = 0;
        this.transparentVertices = 0;
        this.verticesCount = 0;
        this.drawObjDataCount = 0;
    }
}

export default DrawObjQueue;