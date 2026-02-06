import Vec2 from './vec2.js';

// TODO: The output of the triangulation
class TriangulatedPolygon {
    constructor(vertices) {
        this.vertices = [];
        for (let i = 0; i < vertices.length; i++) {
            this.vertices.push(vertices[i].Copy());
        }
        this.indices = [];
    };

    GetVertex(i) {
        return this.vertices[this.indices[i]];
    }
}

class VertexDLL {
    constructor(val, index, prev) {
        this.val = val;
        this.index = index;
        this.prev = prev;
        this.next = null;
    };

    Remove() {
        if (this.next)
            this.next.prev = this.prev;
        if (this.prev)
            this.prev.next = this.next;
        this.next = null;
        this.prev = null;
    }

    GetNormal() {
        const vec90 = new Vec2(1, 0);
        let normal = (this.next.val.Copy().Sub(this.val).Normalize()).Add(this.val.Copy().Sub(this.prev.val).Normalize()).Normalize();
        normal.RotateFromUnitCCW(vec90);
        return normal;
    }

    IsConcave() {
        let v1 = this.val.Copy().Sub(this.prev.val);
        let v2 = this.next.val.Copy().Sub(this.val);
        return v1.Det(v2) >= 0;
    }
}

class PolygonDLL {
    constructor(polygon) {
        let start = new VertexDLL(polygon[0], 0, null);
        let prev = start;
        for (let i = 1; i < polygon.length; i++) {
            let next = new VertexDLL(polygon[i], i, prev);
            prev.next = next;
            prev = next;
        }
        start.prev = prev;
        prev.next = start;

        this.start = start;
        this.size = polygon.length;
    };

    InsertPoint(before, point) {
        let vertex = new VertexDLL(point, -1, before); // TODO: index..?
        if (before.next) {
            vertex.next = before.next;
            before.next.prev = vertex;
        }
        before.next = vertex;
        this.size++;
    }
}

// returns whether p is inside triangle abc (cw)
function PointInTriangle(a, b, c, p) {
    return (b.x - p.x) * (a.y - p.y) >= (a.x - p.x) * (b.y - p.y) &&
           (a.x - p.x) * (c.y - p.y) >= (c.x - p.x) * (a.y - p.y) &&
           (c.x - p.x) * (b.y - p.y) >= (b.x - p.x) * (c.y - p.y);
}

class Triangulator {

    static TriangulatePolygon(polygon) {
        // console.time('TriangulatePolygon');

        let triangulated = new TriangulatedPolygon(polygon);
        let remainingN = polygon.length;

        // construct circular DLL of vertices
        let p = new PolygonDLL(polygon).start;

        let its = 0;
        let skips = 0;
        let angThreshold = 40;
        while (remainingN >= 3) {
            its++;
            let prev = p.prev;
            let next = p.next;
            let prevLine = p.val.Copy().Sub(prev.val);
            let nextLine = next.val.Copy().Sub(p.val);

            // If point is concave or flat, skip
            let skip = prevLine.GetAngDiff(nextLine) <= angThreshold; // concave ear
            if (!skip) {
                let vertexToTest = next.next;
                for (let i = 0; i < remainingN - 3; i++) {
                    its++;
                    if (PointInTriangle(prev.val, p.val, next.val, vertexToTest.val)) {
                        skip = true; // a vertex is inside the ear, we cannot triangulate it
                        break;
                    }
                    vertexToTest = vertexToTest.next;
                }
            }
            if (skip) {
                if (++skips === remainingN) {
                    if (angThreshold === 0) {
                        // console.log('out');
                        break;
                    }
                    else {
                        angThreshold = 0;
                        skips = 0;
                    }
                }
                p = next;
                continue;
            }
            skips = 0;

            // Vertices can be triangulated, push triangle and remove the center point
            triangulated.indices.push(prev.index);
            triangulated.indices.push(p.index);
            triangulated.indices.push(next.index);
            
            p.Remove();
            remainingN--;
            p = next.next; // a rough heuristic that somehow produces much better quality triangulations for things like spheres...
        }

        // console.timeEnd('TriangulatePolygon');
        // console.log('its:', its);
        return triangulated;
    }

}

export {
    PolygonDLL,
    Triangulator
};