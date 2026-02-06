import { DrawObj, DrawObjFlag } from './draw_obj.js';

// A sprite that sort of drapes the texture along the dimension with n subdivisions.
class CurtainSprite extends DrawObj {
    constructor(spritter, w, h, subdivision, power) {
        subdivision = 0|subdivision;
        if (subdivision < 1)
            subdivision = 1;

        super(spritter);
        this.w = w;
        this.h = h;
        this.subdivision = subdivision;
        this.power = power;
        this.UpdateVertices();
    }

    UpdateVertices() {
        this.vertices = this.spritter.drawObjQueue.vertexBlockAllocator.Allocate(4 * this.subdivision);
        this.spritter.drawObjQueue.MarkDirtyVertices(this.vertices);
        this.indicesCount = 6 * this.subdivision;
        this.indices = new Uint32Array(this.indicesCount);

        const func = x => Math.pow(x, this.power);

        let prevV = 0.5;
        let prevY = -0.5 * this.h * 2;
        for (let i = 0; i < this.subdivision; i++) {
            let v = -(i + 1) / this.subdivision + 0.5;
            let y = (func((i + 1) / this.subdivision) - 0.5) * this.h * 2;

            this.vertices[i*4 + 0].set([0.5, v, 1, 1,       this.w, y]); // tr
            this.vertices[i*4 + 1].set([0.5, prevV, 1, 1,   this.w, prevY]); // br
            this.vertices[i*4 + 2].set([-0.5, prevV, 1, 1,  -this.w, prevY]); // bl
            this.vertices[i*4 + 3].set([-0.5, v, 1, 1,      -this.w, y]); // tl

            let trStart = this.GetVertexStart(this.vertices[i*4 + 0]);
            let brStart = this.GetVertexStart(this.vertices[i*4 + 1]);
            let blStart = this.GetVertexStart(this.vertices[i*4 + 2]);
            let tlStart = this.GetVertexStart(this.vertices[i*4 + 3]);
            this.indices.set([
                trStart, brStart, blStart,
                trStart, blStart, tlStart,
            ], i * 6);

            prevY = y;
            prevV = v;
        }
    }
}

export default CurtainSprite;