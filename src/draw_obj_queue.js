const MAX_DRAWOBJS = 10000;

class DrawObjHolder {
    constructor(drawObj, mat3, priority) {
        this.drawObj = drawObj;
        this.mat3 = mat3;
        this.priority = priority;
    }
}

class DrawObjQueue {
    constructor(spritter) {
        this.spritter = spritter;

        this.count = 0;
        this.buffer = [];

        this.vertexBufferSize = 4096 * 1024;
        this.verticesCount = 0;
        this.vertexStaging = new Float32Array(this.vertexBufferSize);
        this.vertexStagingUint32 = new Uint32Array(this.vertexStaging.buffer);
        this.vertexBufferEntrySize = 8;
        this.vertexBufferEntryBytes = this.vertexBufferEntrySize * this.vertexStaging.BYTES_PER_ELEMENT;
        this.vertexBuffer = spritter.device.createBuffer({
            size: this.vertexStaging.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
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

    Flush() {
        this.verticesCount = 0;
        this.buffer.length = 0;
    }

    BufferDrawobj(drawobj, priority) {
        if (this.count === MAX_DRAWOBJS) {
            console.warn("Drawobj queue full.");
            return;
        }

        let holder = new Holder(drawobj, drawobj.mat3.Copy(), priority); // TODO: We can make this a pool
        this.buffer.splice(this.GetDrawobjUpperBound(holder), 0, holder); // Do this or sort once at the end?
        this.count++;
    }

    WriteVerticesToStage(vertices, increment) {
        this.vertexStaging.set(vertices, this.verticesCount * this.vertexBufferEntrySize);
        this.verticesCount += increment;
    }

    WriteAllDrawObjVerticesToStage() {
        this.verticesCount = 0;
        for (holder of this.buffer) {
            holder.drawObj.WriteVerticesAt(this, holder.mat3);
        }
    }

    UploadStageToVertexBuffer() {
        this.spritter.device.queue.writeBuffer(
            this.vertexBuffer,
            0,
            this.vertexStaging.buffer,
            this.vertexStaging.byteOffset,
            this.verticesCount * this.vertexBufferEntryBytes
        );
    }
}