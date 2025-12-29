const MAX_DRAWOBJS = 10000;

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

        // DrawObjHolder array
        this.holders = [];

        // DrawObj storage buffer
        this.storageBufferSize = 4096 * 1024;
        this.storageStage = new Float32Array(this.storageBufferSize);
        this.storageBuffer = spritter.device.createBuffer({
            size: this.storageStage.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.drawObjDataCount = 0;
        this.drawObjDataEntrySize = 32;
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
        this.vertexBufferEntrySize = 5;
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
                    format: 'float32x2'
                },
                {
                    shaderLocation: 2,
                    offset: 4 * 4,
                    format: 'uint32'
                },
            ]
        };
    }

    GetDrawobjUpperBound(holder) {
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

    BufferDrawobj(drawobj, priority = 0) {
        if (this.count === MAX_DRAWOBJS) {
            console.warn("Drawobj queue full.");
            return;
        }

        let holder = new DrawObjHolder(drawobj, drawobj.mat3.Copy(), priority); // TODO: We can make this a pool
        this.holders.splice(this.GetDrawobjUpperBound(holder), 0, holder); // Do this or sort once at the end?
    }

    BufferDrawObjData(data) {
        this.storageStage.set(data, this.drawObjDataCount * this.drawObjDataEntrySize);
        this.drawObjDataCount++;
    }

    BufferDrawObjVertices(vertices, increment) {
        this.verticesStage.set(vertices, this.verticesCount * this.vertexBufferEntrySize);
        this.verticesCount += increment;
    }

    PushDrawObjsToStageBuffers() {
        // this.verticesCount = 0;
        for (let i = 0; i < this.holders.length; i++) {
            let holder = this.holders[i];
            holder.drawObj.BufferDataAt(this, holder.mat3, i);
            holder.drawObj.BufferVerticesAt(this, holder.mat3, i);
        }
        // this.holders.length = 0;
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
        // console.log(this.drawObjDataCount, this.verticesCount);
        this.holders.length = 0;
        this.verticesCount = 0;
        this.drawObjDataCount = 0;
    }
}

export default DrawObjQueue;