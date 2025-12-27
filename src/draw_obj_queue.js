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

        this.count = 0;
        this.buffer = [];

        // TODO: DrawObj Uniform buffer

        // Vertex buffer
        this.vertexBufferEntrySize = 8;
        this.vertexBufferSize = 4096 * 1024;
        this.verticesCount = 0;
        this.verticesStage = new Float32Array(this.vertexBufferSize);
        this.verticesStage_Uint32 = new Uint32Array(this.verticesStage.buffer);
        this.vertexBuffer = spritter.device.createBuffer({
            size: this.verticesStage.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
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
                    format: 'float32x2'
                },
                {
                    shaderLocation: 3,
                    offset: 4 * 6,
                    format: 'float32x2'
                }
            ]
        }
    }

    GetDrawobjUpperBound(holder) {
        let low = 0;
        let high = this.buffer.length - 1;

        while (low <= high) {
            let mid = (low + high) >> 1;
            if (this.buffer[mid].priority > holder.priority)
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
        this.buffer.splice(this.GetDrawobjUpperBound(holder), 0, holder); // Do this or sort once at the end?
        this.count++;
    }

    BufferVertices(vertices, increment) {
        this.verticesStage.set(vertices, this.verticesCount * this.vertexBufferEntrySize);
        this.verticesCount += increment;
    }

    PushDrawObjBufferToVertices() {
        // this.verticesCount = 0;
        for (let holder of this.buffer) {
            holder.drawObj.BufferVerticesAt(this, holder.mat3);
        }
        // this.buffer.length = 0;
    }

    UploadVerticesToVertexBuffer() {
        this.spritter.device.queue.writeBuffer(
            this.vertexBuffer,
            0,
            this.verticesStage.buffer,
            this.verticesStage.byteOffset,
            this.verticesCount * this.vertexBufferEntryByteSize
        );
    }

    Flush() {
        this.count = 0;
        this.verticesCount = 0;
        this.buffer.length = 0;
    }
}

export default DrawObjQueue;