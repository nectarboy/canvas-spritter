import Mat3 from '../mat3.js';
import Vec2 from '../vec2.js';

class DrawObj {
    constructor() {
        this.mat3 = new Mat3().ToIdentity();
        // this.texName = '';
        // this.textured = false;

        this.atlasDimension = -1;
        this.iAtlasDimension = -1;
        this.atlasPos = new Vec2(0, 0);
        this.atlasSize = new Vec2(0, 0);
        this.atlasUv0 = new Vec2(0, 0);
        this.atlasUv1 = new Vec2(0, 0);

        this.posOffset = new Vec2(0, 0);

        this.patternMode = false;
    };

    SetTexture(atlas, texName) {
        let texBounds = atlas.GetTextureBounds(texName);
        if (texBounds === null)
            return;

        this.atlasDimension = atlas.dimension;
        this.iAtlasDimension = 1 / atlas.dimension;
        this.atlasPos.SetXY(texBounds.x, texBounds.y);
        this.atlasSize.SetXY(texBounds.w, texBounds.h);
        this.atlasUv0.SetXY(texBounds.x * this.iAtlasDimension, texBounds.y * this.iAtlasDimension);
        this.atlasUv1.Set(this.atlasUv0).AddXY(texBounds.w * this.iAtlasDimension, texBounds.h * this.iAtlasDimension);
    }

    BufferDataAt(queue, mat3, i) {
        const uvMat3 = new Mat3();

        if (this.patternMode)
            uvMat3.ScaleXY(0.5 / this.atlasSize.x, 0.5 / this.atlasSize.y);

        // uvMat3.TranslateXY(queue.spritter.tick * 1 / this.atlasSize.x, 0);
        uvMat3.ScaleXY(4, 4);
        uvMat3.Rotate(queue.spritter.tick / 2);

        queue.BufferDrawObjData([
            mat3.m[0], mat3.m[1], mat3.m[2], 0,
            mat3.m[3], mat3.m[4], mat3.m[5], 0,
            mat3.m[6], mat3.m[7], mat3.m[8], 0,

            uvMat3.m[0], uvMat3.m[1], uvMat3.m[2], 0,
            uvMat3.m[3], uvMat3.m[4], uvMat3.m[5], 0,
            uvMat3.m[6], uvMat3.m[7], uvMat3.m[8], 0,

            this.atlasPos.x, this.atlasPos.y,
            this.atlasSize.x, this.atlasSize.y,

            this.atlasDimension,
            this.iAtlasDimension,
        ]);
    }

    BufferVerticesAt(queue, mat3, drawObjIndex) {}
}

class DrawObjs {

    static Sprite = class Sprite extends DrawObj {
        constructor(w, h) {
            super();
            this.w = w;
            this.h = h;
        };

        BufferVerticesAt(queue, mat3, drawObjIndex) {
            let halfW = this.w;
            let halfH = this.h;

            let topLeftUv = new Vec2(-0.5, -0.5);
            let topRightUv = new Vec2(0.5, -0.5);
            let botLeftUv = new Vec2(-0.5, 0.5);
            let botRightUv = new Vec2(0.5, 0.5);

            let topLeft = new Vec2(-halfW, halfH);
            let topRight = new Vec2(halfW, halfH);
            let botLeft = new Vec2(-halfW, -halfH);
            let botRight = new Vec2(halfW, -halfH);

            let off = queue.verticesCount * queue.vertexBufferEntrySize;
            queue.verticesStage.set([topRight.x, topRight.y,     topRightUv.x, topRightUv.y], off);
            queue.verticesStage.set([botLeft.x, botLeft.y,       botLeftUv.x, botLeftUv.y], off + 5);
            queue.verticesStage.set([topLeft.x, topLeft.y,       topLeftUv.x, topLeftUv.y], off + 10);
            queue.verticesStage.set([botLeft.x, botLeft.y,       botLeftUv.x, botLeftUv.y], off + 15);
            queue.verticesStage.set([topRight.x, topRight.y,     topRightUv.x, topRightUv.y], off + 20);
            queue.verticesStage.set([botRight.x, botRight.y,     botRightUv.x, botRightUv.y], off + 25);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 4);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 9);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 14);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 19);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 24);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 29);
            queue.verticesCount += 6;
        }
    }

    static Poly = class Poly extends DrawObj {
        constructor(points, pointScale) {
            super();
            this.patternMode = true;
            this.polyVerts = [];
            this.TessellatePoints(points, pointScale);
        }

        BufferVerticesAt(queue, mat3, drawObjIndex) {
            let off = queue.verticesCount * queue.vertexBufferEntrySize;
            for (let i = 0; i < this.polyVerts.length; i++, off += 5) {
                let vert = this.polyVerts[i];
                queue.verticesStage.set([vert.x, vert.y,     vert.x, -vert.y], off);
                queue.verticesStage_Uint32.set([drawObjIndex], off + 4);
            }
            queue.verticesCount += this.polyVerts.length;

            if (queue.spritter.tick === 0) console.log(this.polyVerts);
        }

        // points must be a Vec2 array
        TessellatePoints(points, pointScale) {
            this.polyVerts.length = 0;

            for (let i = 0; i < points.length; i++) {
                let p = points[i];
                let pBefore = (i === 0) ? points[points.length - 1] : points[i - 1];
                let pAfter = (i === points.length - 1) ? points[0] : points[i + 1];
                let lineBefore = p.Copy().Sub(pBefore);
                let lineAfter = pAfter.Copy().Sub(p);

                // If point is concave or flat, skip
                if (lineAfter.GetAngDiff(lineBefore) > 0)
                    continue;

                // Push triangle and remove this point
                this.polyVerts.push(pBefore.Copy().Scale(pointScale));
                this.polyVerts.push(p.Copy().Scale(pointScale));
                this.polyVerts.push(pAfter.Copy().Scale(pointScale));
                points.splice(i, 1);
                i--;

                if (points.length < 3)
                    break;
            }
        }

        TestDraw() {
            let canvas = document.getElementById('binpackcanvas');
            let ctx = canvas.getContext('2d');
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.beginPath();

            let cx = canvas.width/2;
            let cy = canvas.height/2;
            let s = 1;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < this.polyVerts.length; i++) {
                if ((i % 3) === 0) {
                    ctx.stroke();
                    ctx.closePath();
                    ctx.beginPath();
                    ctx.moveTo(cx + s*this.polyVerts[i].x, cy - s*this.polyVerts[i].y);
                }
                let nextP = this.polyVerts[Math.floor(i / 3)*3 + ((i + 1) % 3)];
                ctx.lineTo(cx + s*nextP.x, cy - s*nextP.y);
            }
            ctx.stroke();
            ctx.closePath();

        }
    }

}

export default DrawObjs;