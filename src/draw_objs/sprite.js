import { DrawObj, DrawObjFlag } from './draw_obj.js';

class Sprite extends DrawObj {
    constructor(spritter, w, h) {
        super(spritter);
        this.w = w;
        this.h = h;
        this.UpdateVertices();
    };

    UpdateVertices() {
        this.vertices = this.spritter.drawObjQueue.vertexBlockAllocator.Allocate(4);
        this.vertices[0].set([0.5, -0.5, 1, 1,  this.w, this.h]); // tr
        this.vertices[1].set([0.5, 0.5, 1, 1,   this.w, -this.h]); // br
        this.vertices[2].set([-0.5, 0.5, 1, 1,  -this.w, -this.h]); // bl
        this.vertices[3].set([-0.5, -0.5, 1, 1, -this.w, this.h]); // tl
        this.spritter.drawObjQueue.MarkDirtyVertices(this.vertices);

        this.indicesCount = 6;
        this.indices = new Uint32Array(this.indicesCount);
        this.indices.set([
            this.GetVertexStart(this.vertices[0]),
            this.GetVertexStart(this.vertices[1]),
            this.GetVertexStart(this.vertices[2]),
            this.GetVertexStart(this.vertices[0]),
            this.GetVertexStart(this.vertices[2]),
            this.GetVertexStart(this.vertices[3]),
        ]);
    }
}

export default Sprite;