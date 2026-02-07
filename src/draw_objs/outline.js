import { DrawObj, DrawObjFlag, IntersectionOfLines } from './draw_obj.js';
import { PolygonDLL } from '../triangulator.js';
import Vec2 from '../vec2.js';

const VEC_90 = Vec2.FromAng(90);

const OutlineType = {
    Miter: 1,
    Bevel: 2,
};

class Outline extends DrawObj {
    constructor(spritter, polygon, outerD, innerD) {
        super(spritter);
        this.SetOutline(polygon, outerD, innerD);
    };

    GenerateLineVertices(dll, outerD, innerD) {
        let verts = [];
        let indices = [];

        let point = dll.start;

    }

    Miter(dll, outerD, innerD) {
        this._FreeVertices();
        this.vertices = this.spritter.drawObjQueue.vertexBlockAllocator.Allocate(dll.size * 4);
        this.indicesCount = dll.size * 6;
        this.indices = new Uint32Array(this.indicesCount);

        let point = dll.start;
        let u = -0.5;
        for (let i = 0; i < dll.size; i++) {
            let next = point.next;
            let normal = point.GetNormal();
            let nextNormal = next.GetNormal();
            let lineNormal = next.val.Copy().Sub(point.val).Normalize().RotateFromUnitCCW(VEC_90);
            let dist = point.val.Dist(next.val);

            // Calculate corners
            let dot0 = lineNormal.Dot(normal);
            let dot1 = lineNormal.Dot(nextNormal);
            let tl = point.val.Copy().AddScaled(normal, outerD / dot0);
            let bl = point.val.Copy().AddScaled(normal, -innerD / dot0);
            let tr = next.val.Copy().AddScaled(nextNormal, outerD / dot1);
            let br = next.val.Copy().AddScaled(nextNormal, -innerD / dot1);

            let newU = u + dist / (outerD + innerD) /// ((dot0 + dot1) / 2);

            // Calculate vertex depth weights
            let intersection = IntersectionOfLines(
                tl.x,tl.y, br.x,br.y,
                tr.x,tr.y, bl.x,bl.y
            );
            let trQ, brQ, blQ, tlQ;
            if (intersection === null) {
                trQ = brQ = blQ = tlQ = 1;
            }
            else {
                let topRightD = tr.Dist(intersection);
                let botRightD = br.Dist(intersection);
                let botLeftD = bl.Dist(intersection);
                let topLeftD = tl.Dist(intersection);
                trQ = topRightD / botLeftD + 1; 
                brQ = botRightD / topLeftD + 1;
                blQ = botLeftD / topRightD + 1;
                tlQ = topLeftD / botRightD + 1;
            }

            // Encode vertices and indices
            this.vertices[i*4 + 0].set([newU, -0.5, trQ, 1,    tr.x, tr.y]); // tr
            this.vertices[i*4 + 1].set([newU, 0.5, brQ, 1,     br.x, br.y]); // br
            this.vertices[i*4 + 2].set([u, 0.5, blQ, 1,    bl.x, bl.y]); // bl
            this.vertices[i*4 + 3].set([u, -0.5, tlQ, 1,   tl.x, tl.y]); // tl
            let trStart = this.GetVertexStart(this.vertices[i*4 + 0]);
            let brStart = this.GetVertexStart(this.vertices[i*4 + 1]);
            let blStart = this.GetVertexStart(this.vertices[i*4 + 2]);
            let tlStart = this.GetVertexStart(this.vertices[i*4 + 3]);
            this.indices.set([
                trStart, brStart, blStart,
                trStart, blStart, tlStart,
            ], i * 6);

            point = next;
            u = newU;
        }
    }

    Bevel(dll, outerD, innerD) {
        this._FreeVertices();
        this.vertices = this.spritter.drawObjQueue.vertexBlockAllocator.Allocate(dll.size * 7);
        this.indicesCount = dll.size * 9;
        this.indices = new Uint32Array(this.indicesCount);

        let point = dll.start;
        let u = -0.5;
        for (let i = 0; i < dll.size; i++) {
            let prev = point.prev;
            let next = point.next;
            // let miterNormal = point.GetNormal();
            // let nextMiterNormal = next.GetNormal();
            let prevLineNormal = point.val.Copy().Sub(prev.val).Normalize().RotateFromUnitCCW(VEC_90);
            let lineNormal = next.val.Copy().Sub(point.val).Normalize().RotateFromUnitCCW(VEC_90);
            let nextLineNormal = next.next.val.Copy().Sub(next.val).Normalize().RotateFromUnitCCW(VEC_90);
            let isConcave = point.IsConcave();
            let nextIsConcave = next.IsConcave();

            // ???
            // let cross = point.GetCross();
            // console.log(cross);

            // Calculate corners
            let prevTl = prev.val.Copy().AddScaled(prevLineNormal, outerD);
            let prevBl = prev.val.Copy().AddScaled(prevLineNormal, -innerD);
            let prevTr = point.val.Copy().AddScaled(prevLineNormal, outerD);
            let prevBr = point.val.Copy().AddScaled(prevLineNormal, -innerD);
            let tl = point.val.Copy().AddScaled(lineNormal, outerD);
            let bl = point.val.Copy().AddScaled(lineNormal, -innerD);
            let tr = next.val.Copy().AddScaled(lineNormal, outerD);
            let br = next.val.Copy().AddScaled(lineNormal, -innerD);
            let nextTl = next.val.Copy().AddScaled(nextLineNormal, outerD);
            let nextBl = next.val.Copy().AddScaled(nextLineNormal, -innerD);
            let nextTr = next.next.val.Copy().AddScaled(nextLineNormal, outerD);
            let nextBr = next.next.val.Copy().AddScaled(nextLineNormal, -innerD);

            // Calculate miter points
            let prevInnerMiterPoint = IntersectionOfLines(
                prevBr.x, prevBr.y,  prevBl.x, prevBl.y,
                br.x, br.y,  bl.x, bl.y
            );
            let prevOuterMiterPoint = IntersectionOfLines(
                prevTr.x, prevTr.y,  prevTl.x, prevTl.y,
                tr.x, tr.y,  tl.x, tl.y
            );
            let innerMiterPoint = IntersectionOfLines(
                br.x, br.y,  bl.x, bl.y,
                nextBr.x, nextBr.y,  nextBl.x, nextBl.y
            );
            let outerMiterPoint = IntersectionOfLines(
                tr.x, tr.y,  tl.x, tl.y,
                nextTr.x, nextTr.y,  nextTl.x, nextTl.y
            );

            // console.log(innerMiterPoint, br, bl);

            // Fix corners
            if (isConcave) {
                tl.Set(prevOuterMiterPoint);
            }
            else {
                bl.Set(prevInnerMiterPoint);
            }
            if (nextIsConcave) {
                tr.Set(outerMiterPoint);
            }
            else {
                br.Set(innerMiterPoint);
            }

            let dist = (tl.Dist(tr) + bl.Dist(br)) / 2;
            let botDist = bl.Dist(br);
            let distRatio = dist / botDist;
            let newU = u + dist / (outerD + innerD) /// ((dot0 + dot1) / 2);

            // Calculate rightward chip piece
            let chipTl, chipTr, chipB;
            if (nextIsConcave) {
                chipTl = nextBl;
                chipTr = br;
                chipB = outerMiterPoint;
            }
            else {
                chipTl = tr;
                chipTr = nextTl;
                chipB = innerMiterPoint;
            }
            let chipDist = chipTl.Dist(chipTr);
            let chipNewU = newU + chipDist * Math.SQRT1_2 / (outerD + innerD);

            // Calculate vertex depth weights
            let intersection = IntersectionOfLines(
                tl.x,tl.y, br.x,br.y,
                tr.x,tr.y, bl.x,bl.y
            );
            let trQ, brQ, blQ, tlQ;
            if (intersection === null) {
                trQ = brQ = blQ = tlQ = 1;
            }
            else {
                let topRightD = tr.Dist(intersection);
                let botRightD = br.Dist(intersection);
                let botLeftD = bl.Dist(intersection);
                let topLeftD = tl.Dist(intersection);
                trQ = topRightD / botLeftD + 1; 
                brQ = botRightD / topLeftD + 1;
                blQ = botLeftD / topRightD + 1;
                tlQ = topLeftD / botRightD + 1;
            }

            let chipTlQ, chipTrQ, chipBQ;
            let chipIntersection = IntersectionOfLines(
                chipTl.x,chipTl.y, chipB.x,chipB.y,
                chipTr.x,chipTr.y, chipB.x,chipB.y
            );
            if (true || chipIntersection === null) {
                chipTlQ = chipTrQ = chipBQ = 1;
            }
            else {
                let topLeftD = chipTl.Dist(chipIntersection);
                let topRightD = chipTr.Dist(chipIntersection);
                let botD = chipB.Dist(chipIntersection);
                chipTlQ = topLeftD / botD + 1;
                chipTrQ = topRightD / botD + 1; 
                chipBQ = (botD / topRightD + botD / topLeftD) / 2 + 1; // ?
            }

            // Encode vertices and indices
            this.vertices[i*7 + 0].set([newU, -0.5, trQ, 1,    tr.x, tr.y]); // tr
            this.vertices[i*7 + 1].set([newU, 0.5, brQ, 1,     br.x, br.y]); // br
            this.vertices[i*7 + 2].set([u, 0.5, blQ, 1,    bl.x, bl.y]); // bl
            this.vertices[i*7 + 3].set([u, -0.5, tlQ, 1,   tl.x, tl.y]); // tl
            if (nextIsConcave) {
                this.vertices[i*7 + 4].set([chipNewU, 0.5, chipTlQ, 1,    chipTl.x, chipTl.y]); // chiptl
                this.vertices[i*7 + 5].set([newU, 0.5, chipTrQ, 1,    chipTr.x, chipTr.y]); // chiptr
                this.vertices[i*7 + 6].set([(newU + chipNewU) / 2, -0.5, 0, 1,    chipB.x, chipB.y]); // chipb ?
            }
            else {
                this.vertices[i*7 + 4].set([newU, -0.5, chipTlQ, 1,    chipTl.x, chipTl.y]); // chiptl
                this.vertices[i*7 + 5].set([chipNewU, -0.5, chipTrQ, 1,    chipTr.x, chipTr.y]); // chiptr
                this.vertices[i*7 + 6].set([(newU + chipNewU) / 2, 0.5, 0, 1,    chipB.x, chipB.y]); // chipb ?
            }
            let trStart = this.GetVertexStart(this.vertices[i*7 + 0]);
            let brStart = this.GetVertexStart(this.vertices[i*7 + 1]);
            let blStart = this.GetVertexStart(this.vertices[i*7 + 2]);
            let tlStart = this.GetVertexStart(this.vertices[i*7 + 3]);
            let chipTlStart = this.GetVertexStart(this.vertices[i*7 + 4]);
            let chipTrStart = this.GetVertexStart(this.vertices[i*7 + 5]);
            let chipBStart = this.GetVertexStart(this.vertices[i*7 + 6]);
            this.indices.set([
                trStart, brStart, blStart,
                trStart, blStart, tlStart,
                chipTlStart, chipTrStart, chipBStart
                // 0, 0, 0
            ], i * 9);

            point = next;
            u = chipNewU;
        }
    }

    SetOutline(polygon, outerD, innerD) {
        console.time('SetOutline');

        let dll = new PolygonDLL(polygon);
        let point = dll.start;

        const subdivide = false;
        if (subdivide) {
            for (let i = 0; i < polygon.length; i++) {
                let next = point.next;
                console.log(next.index);
                let middle = point.val.Copy().Add(next.val).Scale(0.5);
                dll.InsertPoint(point, middle);
                point = next;
            }
        }

        console.log(dll);

        // this.Miter(dll, outerD, innerD);
        this.Bevel(dll, outerD, innerD);

        this.spritter.drawObjQueue.MarkDirtyVertices(this.vertices);

        console.timeEnd('SetOutline');
    }
}

export default Outline;