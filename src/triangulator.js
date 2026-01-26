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
    
// TODO: Polygon vertex doubly linked list
class VertexDLL {
    constructor(val, index, prev) {
        this.val = val;
        this.index = index;
        this.prev = prev;
        this.next = null;
        if (prev)
            prev.next = this;
    };

    Remove() {
        if (this.next)
            this.next.prev = this.prev;
        if (this.prev)
            this.prev.next = this.next;
        this.next = null;
        this.prev = null;
    }
}

// returns whether p is inside triangle abc (cw)
function PointInTriangle(a, b, c, p) {
    return (b.x - p.x) * (a.y - p.y) >= (a.x - p.x) * (b.y - p.y) &&
           (a.x - p.x) * (c.y - p.y) >= (c.x - p.x) * (a.y - p.y) &&
           (c.x - p.x) * (b.y - p.y) >= (b.x - p.x) * (c.y - p.y);
}

class Triangulator {

    static TriangulatePolygon(polygon, scale = 1) {
        // console.time('TriangulatePolygon');

        let polyVerts = [];
        let remainingN = polygon.length;

        // construct circular DLL of vertices
        let p = new VertexDLL(polygon[0], 0, null);
        for (let i = 1, prev = p; i < polygon.length; i++) {
            prev = new VertexDLL(polygon[i], i, prev);
            if (i === polygon.length - 1) {
                p.prev = prev;
                prev.next = p;
            }
        }

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
            polyVerts.push(prev.val.Copy().Scale(scale));
            polyVerts.push(p.val.Copy().Scale(scale));
            polyVerts.push(next.val.Copy().Scale(scale));
            
            p.Remove();
            remainingN--;
            p = next.next; // a rough heuristic that somehow produces much better quality triangulations for things like spheres...
        }

        // console.timeEnd('TriangulatePolygon');
        // console.log('its:', its);
        return polyVerts;
    }

}

export default Triangulator;