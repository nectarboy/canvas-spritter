import Vec2 from './vec2.js';

// The output of the triangulation
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
    constructor(vertex, index, prev) {
        this.vertex = vertex;
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

        let remaining = Array.from(polygon);

        let i = 0;
        let skips = 0;
        let angThreshold = 0;
        while (remaining.length >= 3) {
            let p = remaining[i];
            let pBefore = (i === 0) ? remaining[remaining.length - 1] : remaining[i - 1];
            let pAfter = (i === remaining.length - 1) ? remaining[0] : remaining[i + 1];
            let lineBefore = p.Copy().Sub(pBefore);
            let lineAfter = pAfter.Copy().Sub(p);

            // If point is concave or flat, skip
            let skip = lineBefore.GetAngDiff(lineAfter) <= 0; // concave ear
            if (!skip) {
                for (let ii = 0; ii < remaining.length - 3; ii++) {
                    let pointToTest = remaining[(ii + i + 2) % remaining.length];
                    if (PointInTriangle(pBefore, p, pAfter, pointToTest)) {
                        skip = true; // a point is inside the ear
                        break;
                    }
                }
            }
            if (skip) {
                if (++skips === remaining.length) {
                    if (angThreshold === 0) {
                        // console.log('out');
                        break;
                    }
                    else {
                        angThreshold = 0;
                        skips = 0;
                    }
                }
                i = (i + 1) % remaining.length;
                continue;
            }
            skips = 0;

            // Push triangle and remove this point
            polyVerts.push(pBefore.Copy().Scale(scale));
            polyVerts.push(p.Copy().Scale(scale));
            polyVerts.push(pAfter.Copy().Scale(scale));
            remaining.splice(i, 1);
            if (i === remaining.length) i = 0;
        }

        // console.timeEnd('TriangulatePolygon');
        return polyVerts;
    }

}

export default Triangulator;