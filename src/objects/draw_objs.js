import Mat3 from '../mat3.js';
import Vec2 from '../vec2.js';

const DrawObjFlag = {
    UseTexture: 0x1,
    UseSecondaryTexture: 0x2,
    RepeatTexture: 0x4,
    RepeatSecondaryTexture: 0x8,
    FilterTexture: 0x10,
    FilterSecondaryTexture: 0x20,
    MaskTextureMode: 0x40,              // Use secondary texture as a soft-mask
    MaskTextureColorChannels: 0x80,     // (When Mask Mode enabled) mask texture color channels too
    DisplacementTextureMode: 0x100,     // Use secondary texture as a displacement map
    PatternMode: 0x200,                 // Use texture's real size instead of DrawObj size
    FlipTextureX: 0x400,
    FlipTextureY: 0x800,
    FlipSecondaryTextureX: 0x1000,
    FlipSecondaryTextureY: 0x2000
};

class DrawObj {
    constructor() {
        this.mat3 = new Mat3().ToIdentity();
        this.flags = 0;
        this.transparent = true;

        this.atlas = null;
        this.atlasDimension = -1;
        this.iAtlasDimension = -1;

        this.texPos = new Vec2(0, 0);
        this.texSize = new Vec2(0, 0);
        this.texIsFullyOpaque = false;
        this.tex2Pos = new Vec2(0, 0);
        this.tex2Size = new Vec2(0, 0);
        this.tex2IsFullyOpaque = false;

        this.tintColor = { r: 1, g: 1, b: 1, a: 1 };

        // If a pixel's channel > channel of lower threshold and <= channel of upper threshold, the channel will be zeroed out.
        this.thresholdLowerColor = { r: 1, g: 1, b: 1, a: 1 };
        this.thresholdUpperColor = { r: 1, g: 1, b: 1, a: 1 };

        // The opacity of tex2 being overlayed on top of tex1. If 0.0, only tex1 will show as normal.
        this.tex2Alpha = 0;

        this.posOffset = new Vec2(0, 0);

        this.patternMode = false;
    };

    IsFullyOpaque() {
        if ((this.tintColor.a < 1) | (this.thresholdLowerColor.a < 1)) {
            return false;
        }

        if (((this.flags & DrawObjFlag.UseTexture) !== 0) & (!this.texIsFullyOpaque)) {
            return false;
        }

        if ((this.flags & (DrawObjFlag.UseSecondaryTexture | DrawObjFlag.MaskTextureMode)) === (DrawObjFlag.UseSecondaryTexture | DrawObjFlag.MaskTextureMode)) {
            return false;
        }

        return true;
    }

    SetFlags(flags) {
        this.flags |= flags;
    }

    ClearFlags(flags) {
        this.flags &= ~flags;
    }

    SetTextureAtlas(atlas) {
        this.atlas = atlas;
        this.atlasDimension = atlas.dimension;
        this.iAtlasDimension = atlas.iDimension;
        this.ClearFlags(DrawObjFlag.UseTexture | DrawObj.UseSecondaryTexture);
    }

    SetTexture(texName) {
        let tex = this.atlas.GetTextureInfo(texName);
        if (tex === null) {
            this.UnsetTexture();
            return;
        }
        this.texPos.SetXY(tex.bounds.x, tex.bounds.y);
        this.texSize.SetXY(tex.bounds.w, tex.bounds.h);
        this.texIsFullyOpaque = tex.fullyOpaque;
        this.SetFlags(DrawObjFlag.UseTexture);
    }

    SetSecondaryTexture(texName) {
        let tex = this.atlas.GetTextureInfo(texName);
        if (tex === null) {
            this.UnsetSecondaryTexture();
            return;
        }
        this.tex2Pos.SetXY(tex.bounds.x, tex.bounds.y);
        this.tex2Size.SetXY(tex.bounds.w, tex.bounds.h);
        this.tex2IsFullyOpaque = tex.fullyOpaque;
        this.SetFlags(DrawObjFlag.UseSecondaryTexture);
    }

    UnsetTexture() {
        this.ClearFlags(DrawObjFlag.UseTexture);
    }

    UnsetSecondaryTexture() {
        this.ClearFlags(DrawObjFlag.UseSecondaryTexture);
        this.tex2Alpha = 0;
    }

    SetMaskMode(enable) {
        if (enable)
            this.SetFlags(DrawObjFlag.MaskTextureMode);
        else
            this.ClearFlags(DrawObjFlag.MaskTextureMode);
    }

    SetDisplacementMode(enable) {
        if (enable)
            this.SetFlags(DrawObjFlag.DisplacementTextureMode);
        else
            this.ClearFlags(DrawObjFlag.DisplacementTextureMode);
    }

    BufferDataAt(queue, holder, ordering) {
        let now = new Date() / 1000;

        const mat3 = holder.mat3;
        const texMat3 = new Mat3();
        const tex2Mat3 = new Mat3();

        if (this.patternMode)
            texMat3.ScaleXY(0.5 / this.texSize.x, 0.5 / this.texSize.y);

        // tex2Mat3.TranslateXY(Math.sin(now) * 20 / this.tex2Size.x, 0);
        // texMat3.ScaleXY(4, 4);
        // tex2Mat3.Rotate(now * 100);

        texMat3.TranslateXY(queue.spritter.tick * 0.1 / this.texSize.x, Math.sin(now));

        let off = queue.drawObjDataCount * queue.drawObjDataEntrySize;
        queue.storageStage.set([
            mat3.m[0], mat3.m[1], mat3.m[2], 0,
            mat3.m[3], mat3.m[4], mat3.m[5], 0,
            mat3.m[6], mat3.m[7], mat3.m[8], 0,

            texMat3.m[0], texMat3.m[1], texMat3.m[2], 0,
            texMat3.m[3], texMat3.m[4], texMat3.m[5], 0,
            texMat3.m[6], texMat3.m[7], texMat3.m[8], 0,

            tex2Mat3.m[0], tex2Mat3.m[1], tex2Mat3.m[2], 0,
            tex2Mat3.m[3], tex2Mat3.m[4], tex2Mat3.m[5], 0,
            tex2Mat3.m[6], tex2Mat3.m[7], tex2Mat3.m[8], 0,

            this.tintColor.r, this.tintColor.g, this.tintColor.b, this.tintColor.a, 

            this.thresholdLowerColor.r, this.thresholdLowerColor.g, this.thresholdLowerColor.b, this.thresholdLowerColor.a, 
            this.thresholdUpperColor.r, this.thresholdUpperColor.g, this.thresholdUpperColor.b, this.thresholdUpperColor.a, 

            this.texPos.x, this.texPos.y,
            this.texSize.x, this.texSize.y,

            this.tex2Pos.x, this.tex2Pos.y,
            this.tex2Size.x, this.tex2Size.y,

            this.tex2Alpha,

            this.atlasDimension,
            this.iAtlasDimension,

            ordering
        ], off);
        queue.storageStage_Uint32[off + 60] = this.flags;

        queue.drawObjDataCount++;
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

        BufferVerticesAt(queue, holder, drawObjIndex) {
            let off = queue.verticesCount * queue.vertexBufferEntrySize;
            queue.verticesStage.set([this.w, this.h,        0.5, -0.5, 1, 0], off); // tr
            queue.verticesStage.set([-this.w, -this.h,        -0.5, 0.5, 1, 0], off + 7); // bl
            queue.verticesStage.set([-this.w, this.h,        -0.5, -0.5, 1, 0], off + 14); // tl
            queue.verticesStage.set([-this.w, -this.h,      -0.5, 0.5, 1, 0], off + 21); // bl
            queue.verticesStage.set([this.w, this.h,    0.5, -0.5, 1, 0], off + 28); // tr
            queue.verticesStage.set([this.w, -this.h,    0.5, 0.5, 1, 0], off + 35); // br
            queue.verticesStage_Uint32.set([drawObjIndex], off + 6);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 13);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 20);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 27);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 34);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 41);
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

        BufferVerticesAt(queue, holder, drawObjIndex) {
            let off = queue.verticesCount * queue.vertexBufferEntrySize;
            for (let i = 0; i < this.polyVerts.length; i++, off += 7) {
                let vert = this.polyVerts[i];
                queue.verticesStage.set([vert.x, vert.y,     vert.x, -vert.y, 1, 0], off);
                queue.verticesStage_Uint32.set([drawObjIndex], off + 6);
            }
            queue.verticesCount += this.polyVerts.length;

            // if (queue.spritter.tick === 0) console.log(this.polyVerts);
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

    // Choose arbitrary points for your quad and it will appear perspective correct with this nifty DrawObj.
    static PerspectiveSprite = class PerspectiveSprite extends DrawObj {
        constructor() {
            super();
            this.topLeft = new Vec2(-1, 1);
            this.topRight = new Vec2(1, 1);
            this.botRight = new Vec2(1, -1);
            this.botLeft = new Vec2(-1, -1);
            this.tlQ = 1;
            this.trQ = 1;
            this.brQ = 1;
            this.blQ = 1;
            this.UpdatePerspectiveWeights();
        }

        UpdatePerspectiveWeights() {
            let intersection = IntersectionOfLines(this.topLeft, this.botRight, this.topRight, this.botLeft);
            if (intersection === null) {
                this.tlQ = this.trQ = this.brQ = this.blQ = 1;
            }
            else {
                let topLeftD = this.topLeft.Dist(intersection);
                let topRightD = this.topRight.Dist(intersection);
                let botRightD = this.botRight.Dist(intersection);
                let botLeftD = this.botLeft.Dist(intersection);
                this.tlQ = topLeftD / botRightD + 1;
                this.trQ = topRightD / botLeftD + 1; 
                this.brQ = botRightD / topLeftD + 1;
                this.blQ = botLeftD / topRightD + 1;
            }
        }

        BufferVerticesAt(queue, holder, drawObjIndex) {
            let off = queue.verticesCount * queue.vertexBufferEntrySize;
            queue.verticesStage.set([this.topRight.x, this.topRight.y,     0.5 * this.trQ, -0.5 * this.trQ, this.trQ, 0], off);
            queue.verticesStage.set([this.botLeft.x, this.botLeft.y,       -0.5 * this.blQ, 0.5 * this.blQ, this.blQ, 0], off + 7);
            queue.verticesStage.set([this.topLeft.x, this.topLeft.y,       -0.5 * this.tlQ, -0.5 * this.tlQ, this.tlQ, 0], off + 14);
            queue.verticesStage.set([this.botLeft.x, this.botLeft.y,       -0.5 * this.blQ, 0.5 * this.blQ, this.blQ, 0], off + 21);
            queue.verticesStage.set([this.topRight.x, this.topRight.y,     0.5 * this.trQ, -0.5 * this.trQ, this.trQ, 0], off + 28);
            queue.verticesStage.set([this.botRight.x, this.botRight.y,     0.5 * this.brQ, 0.5 * this.brQ, this.brQ, 0], off + 35);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 6);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 13);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 20);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 27);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 34);
            queue.verticesStage_Uint32.set([drawObjIndex], off + 41);
            queue.verticesCount += 6;
        }
    }

}

function IntersectionOfLines(a1, a2, b1, b2) {
    let aA = a2.y - a1.y;
    let aB = a1.x - a2.x;
    let aC = a1.y * a2.x - a1.x * a2.y;

    let bA = b2.y - b1.y;
    let bB = b1.x - b2.x;
    let bC = b1.y * b2.x - b1.x * b2.y;

    let denom = aA * bB - bA * aB;
    if (Math.abs(denom) < 1e-12)
        return null;

    return new Vec2(
        (aB * bC - bB * aC) / denom,
        (bA * aC - aA * bC) / denom
    );
}

function UnitTest() {
    let test1 = IntersectionOfLines(
        new Vec2(0, 1), new Vec2(2, 0),
        new Vec2(0, 0), new Vec2(2, 1),
    );
    if (!test1.EqualsXY(1, 0.5))
        throw new Error('failed 1 ' + test1.ToString());
}

UnitTest();

export {
    DrawObjFlag,
    DrawObjs,
};