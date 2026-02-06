import { DrawObj, DrawObjFlag, IntersectionOfLines, DATA_ARRAY, DATA_BYTES } from './draw_obj.js';
import Vec2 from '../vec2.js';

// Choose arbitrary points for your quad and it will appear perspective correct with this nifty DrawObj.
class PerspectiveSprite extends DrawObj {
    constructor(spritter, w, h) {
        super(spritter);
        this.topRight = null;
        this.botRight = null;
        this.botLeft = null;
        this.topLeft = null;
        this.UpdateVertices(w, h);
    }

    UpdateVertices(w, h) {
        this.vertices = this.spritter.drawObjQueue.vertexBlockAllocator.Allocate(4);
        this.vertices[0].set([0.5, -0.5, 1, 1,  w, h]); // tr
        this.vertices[1].set([0.5, 0.5, 1, 1,   w, -h]); // br
        this.vertices[2].set([-0.5, 0.5, 1, 1,  -w, -h]); // bl
        this.vertices[3].set([-0.5, -0.5, 1, 1, -w, h]); // tl
        this.spritter.drawObjQueue.MarkDirtyVertices(this.vertices);

        this.topRight = new DATA_ARRAY(this.vertices[0].buffer, this.vertices[0].byteOffset + 4 * DATA_BYTES, 2);
        this.botRight = new DATA_ARRAY(this.vertices[1].buffer, this.vertices[1].byteOffset + 4 * DATA_BYTES, 2);
        this.botLeft = new DATA_ARRAY(this.vertices[2].buffer, this.vertices[2].byteOffset + 4 * DATA_BYTES, 2);
        this.topLeft = new DATA_ARRAY(this.vertices[3].buffer, this.vertices[3].byteOffset + 4 * DATA_BYTES, 2);

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

    UpdatePerspectiveWeights() {
        let intersection = IntersectionOfLines(
            this.topLeft[0],this.topLeft[1], this.botRight[0],this.botRight[1],
            this.topRight[0],this.topRight[1], this.botLeft[0],this.botLeft[1]
        );

        let trQ, brQ, blQ, tlQ;

        if (intersection === null) {
            trQ = brQ = blQ = tlQ = 1;
        }
        else {
            let topRightD = new Vec2(this.topRight[0], this.topRight[1]).Dist(intersection);
            let botRightD = new Vec2(this.botRight[0], this.botRight[1]).Dist(intersection);
            let botLeftD = new Vec2(this.botLeft[0], this.botLeft[1]).Dist(intersection);
            let topLeftD = new Vec2(this.topLeft[0], this.topLeft[1]).Dist(intersection);
            trQ = topRightD / botLeftD + 1; 
            brQ = botRightD / topLeftD + 1;
            blQ = botLeftD / topRightD + 1;
            tlQ = topLeftD / botRightD + 1;
        }

        // this.vertices[0][0] = 0.5;
        // this.vertices[0][1] = -0.5;
        this.vertices[0][2] = trQ;
        this.vertices[0][3] = trQ;
        // this.vertices[1][0] = 0.5 * brQ;
        // this.vertices[1][1] = 0.5 * brQ;
        this.vertices[1][2] = brQ;
        this.vertices[1][3] = brQ;
        // this.vertices[2][0] = -0.5 * blQ;
        // this.vertices[2][1] = 0.5 * blQ;
        this.vertices[2][2] = blQ;
        this.vertices[2][3] = blQ;
        // this.vertices[3][0] = -0.5 * tlQ;
        // this.vertices[3][1] = -0.5 * tlQ;
        this.vertices[3][2] = tlQ;
        this.vertices[3][3] = tlQ;
        this.spritter.drawObjQueue.MarkDirtyVertices(this.vertices);
    }
}

export default PerspectiveSprite;