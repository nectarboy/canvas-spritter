import { DrawObj, DrawObjFlag } from './draw_obj.js';
import { Triangulator } from '../triangulator.js';

class Poly extends DrawObj {
    constructor(spritter, points) {
        super(spritter);
        this.SetFlags(DrawObjFlag.PatternMode | DrawObjFlag.SecondaryPatternMode);
        this.SetPoints(points);
    }

    SetPoints(points) {
        this._FreeVertices();
        let triangulated = Triangulator.TriangulatePolygon(points);
        this.UpdateVertices(triangulated);
    }

    UsePointsOfPoly(poly) {
        if (poly === null || this.vertices === poly.vertices)
            return;

        this._FreeVertices();
        this.vertices = poly.vertices;
        this.indices = poly.vertices;
    }

    UpdateVertices(triangulated) {
        this.vertices = this.spritter.drawObjQueue.vertexBlockAllocator.Allocate(triangulated.vertices.length);
        for (let i = 0; i < triangulated.vertices.length; i++) {
            let vertex = triangulated.vertices[i];
            this.vertices[i].set([vertex.x, -vertex.y, 1, 1,  vertex.x, vertex.y]);
        }
        this.spritter.drawObjQueue.MarkDirtyVertices(this.vertices);

        // TODO: optimize
        this.indicesCount = triangulated.indices.length;
        this.indices = new Uint32Array(this.indicesCount);
        for (let i = 0; i < this.indices.length; i++) {
            this.indices[i] = this.GetVertexStart(this.vertices[triangulated.indices[i]]);
        }
    }
}

export default Poly;