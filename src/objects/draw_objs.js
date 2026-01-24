import Mat3 from '../mat3.js';
import DataMat3 from '../data_mat3.js';
import Vec2 from '../vec2.js';
import Triangulator from '../triangulator.js';

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
    SecondaryPatternMode: 0x400,        // Use secondary texture as pattern
    FlipTextureX: 0x800,
    FlipTextureY: 0x1000,
    FlipSecondaryTextureX: 0x2000,
    FlipSecondaryTextureY: 0x4000,
    SecondaryTextureAddBlend: 0x8000    // Simply adds the second texture instead of proper alpha blending
};

const DATA_ARRAY = Float32Array; // Float32Array makes copying data to buffers MUCH faster than Float64Array
const DATA_BYTES = DATA_ARRAY.BYTES_PER_ELEMENT;
const WHITE = new DATA_ARRAY(4);
WHITE.set([1, 1, 1, 1]);

class DrawObj {
    constructor() {
        this.transparent = true;
        this.posOffset = new Vec2(0, 0);

        this.data = new DATA_ARRAY(64);

        this.mat3 = new DataMat3(new DATA_ARRAY(this.data.buffer, 0 * DATA_BYTES, 12)).ToIdentity();

        // currently, these transforms can be thought of as a 'camera' with its own position, orientation, and scale, that 'captures' the texture.
        // example, scaling texMat3 up, makes the 'camera' 'bigger', effectively making the textures tiling look smaller, instead of what one would expect, that is making the textures look bigger.
        // this will probably be changed sometime when i figure out how...
        this.texMat3 = new DataMat3(new DATA_ARRAY(this.data.buffer, 12 * DATA_BYTES, 12)).ToIdentity();
        this.tex2Mat3 = new DataMat3(new DATA_ARRAY(this.data.buffer, 24 * DATA_BYTES, 12)).ToIdentity();

        this.tintColor = new DATA_ARRAY(this.data.buffer, 36 * DATA_BYTES, 4);
        this.tintColor.set(WHITE);

        // If a pixel's channel > channel of lower threshold and <= channel of upper threshold, the channel will be zeroed out.
        this.thresholdLowerColor = new DATA_ARRAY(this.data.buffer, 40 * DATA_BYTES, 4);
        this.thresholdUpperColor = new DATA_ARRAY(this.data.buffer, 44 * DATA_BYTES, 4);
        this.thresholdLowerColor.set(WHITE);
        this.thresholdLowerColor.set(WHITE);

        this.texPos = new DATA_ARRAY(this.data.buffer, 48 * DATA_BYTES, 2);
        this.texSize = new DATA_ARRAY(this.data.buffer, 50 * DATA_BYTES, 2);
        this.texIsFullyOpaque = false;

        this.tex2Pos = new DATA_ARRAY(this.data.buffer, 52 * DATA_BYTES, 2);
        this.tex2Size = new DATA_ARRAY(this.data.buffer, 54 * DATA_BYTES, 2);
        this.tex2IsFullyOpaque = false;

        // The opacity of tex2 being overlayed on top of tex1. If 0.0, only tex1 will show as normal.
        this.tex2Alpha = new DATA_ARRAY(this.data.buffer, 56 * DATA_BYTES, 1);

        this.atlas = null;
        this.atlasDimension = new DATA_ARRAY(this.data.buffer, 57 * DATA_BYTES, 1);
        this.iAtlasDimension = new DATA_ARRAY(this.data.buffer, 58 * DATA_BYTES, 1);

        // Set by the queue, do not use this value!
        this.ordering = new DATA_ARRAY(this.data.buffer, 59 * DATA_BYTES, 1);

        this.flags = new Uint32Array(this.data.buffer, 60 * DATA_BYTES, 1);
        this.SetFlags(DrawObjFlag.RepeatTexture | DrawObjFlag.RepeatSecondaryTexture);
    };

    IsFullyOpaque() {
        const flags = this.flags[0];

        // Is opaque if all of the following are true
        return (
            // Is not transparent and doesn't use threshold cutting
            ((this.tintColor[3] === 1) & (this.thresholdLowerColor[3] === 1)) &
            // Texture repeats
            ((this.flags[0] & DrawObjFlag.RepeatTexture) !== 0) &
            // Doesn't use texture or texture is fully opaque
            (((this.flags[0] & DrawObjFlag.UseTexture) === 0) | (this.texIsFullyOpaque)) &
            // Not using secondary texture or not using secondary texture as a mask
            (((this.flags[0] & DrawObjFlag.UseSecondaryTexture) === 0) | ((this.flags[0] & DrawObjFlag.MaskTextureMode) === 0))
        );

        // if ((this.tintColor[3] < 1) | (this.thresholdLowerColor[3] < 1)) {
        //     return false;
        // }

        // if ((flags & DrawObjFlag.RepeatTexture) === 0) {
        //     return false;
        // }

        // if (((flags & DrawObjFlag.UseTexture) !== 0) & (!this.texIsFullyOpaque)) {
        //     return false;
        // }

        // if ((flags & (DrawObjFlag.UseSecondaryTexture | DrawObjFlag.MaskTextureMode)) === (DrawObjFlag.UseSecondaryTexture | DrawObjFlag.MaskTextureMode)) {
        //     return false;
        // }

        // return true;
    }

    SetFlags(flags) {
        this.flags[0] |= flags;
    }

    ClearFlags(flags) {
        this.flags[0] &= ~flags;
    }

    SetTextureAtlas(atlas) {
        this.atlas = atlas;
        this.atlasDimension[0] = atlas.dimension;
        this.iAtlasDimension[0] = atlas.iDimension;
        this.ClearFlags(DrawObjFlag.UseTexture | DrawObj.UseSecondaryTexture);
    }

    SetTexture(texName) {
        let tex = this.atlas.GetTextureInfo(texName);
        if (tex === null) {
            this.UnsetTexture();
            return;
        }
        this.texPos[0] = tex.bounds.x;
        this.texPos[1] = tex.bounds.y;
        this.texSize[0] = tex.bounds.w;
        this.texSize[1] = tex.bounds.h;
        this.texIsFullyOpaque = tex.fullyOpaque;
        this.SetFlags(DrawObjFlag.UseTexture);
    }

    SetSecondaryTexture(texName) {
        let tex = this.atlas.GetTextureInfo(texName);
        if (tex === null) {
            this.UnsetSecondaryTexture();
            return;
        }
        this.tex2Pos[0] = tex.bounds.x;
        this.tex2Pos[1] = tex.bounds.y;
        this.tex2Size[0] = tex.bounds.w;
        this.tex2Size[1] = tex.bounds.h;
        this.tex2IsFullyOpaque = tex.fullyOpaque;
        this.SetFlags(DrawObjFlag.UseSecondaryTexture);
    }

    UnsetTexture() {
        this.ClearFlags(DrawObjFlag.UseTexture);
    }

    UnsetSecondaryTexture() {
        this.ClearFlags(DrawObjFlag.UseSecondaryTexture);
        this.tex2Alpha[0] = 0;
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

    CopyDataTo(data, dataU32) {
        data.set(this.data);
        if (DATA_BYTES !== 4) {
            dataU32[60] = this.flags;
        }
    }

    BufferVerticesAt(queue, mat3, drawObjIndex) {}
}

class DrawObjs {

    static Sprite = class Sprite extends DrawObj {
        constructor(w, h) {
            super();
            this.w = w;
            this.h = h;

            this.vertices = new Float32Array(42);
            this.vertices_Uint32 = new Uint32Array(this.vertices.buffer);
            this.UpdateVertices();
        };

        UpdateVertices() {
            this.vertices.set([this.w, this.h,        0.5, -0.5, 1, 0], 0); // tr
            this.vertices.set([-this.w, -this.h,        -0.5, 0.5, 1, 0], 7); // bl
            this.vertices.set([-this.w, this.h,        -0.5, -0.5, 1, 0], 14); // tl
            this.vertices.set([-this.w, -this.h,      -0.5, 0.5, 1, 0], 21); // bl
            this.vertices.set([this.w, this.h,    0.5, -0.5, 1, 0], 28); // tr
            this.vertices.set([this.w, -this.h,    0.5, 0.5, 1, 0], 35); // br
        }

        BufferVerticesAt(queue, holder, drawObjIndex) {
            this.vertices_Uint32[6] = drawObjIndex;
            this.vertices_Uint32[13] = drawObjIndex;
            this.vertices_Uint32[20] = drawObjIndex;
            this.vertices_Uint32[27] = drawObjIndex;
            this.vertices_Uint32[34] = drawObjIndex;
            this.vertices_Uint32[41] = drawObjIndex;

            let off = queue.verticesCount * queue.vertexBufferEntrySize;
            queue.verticesStage.set(this.vertices, off);
            queue.verticesCount += 6;
        }
    }

    static Poly = class Poly extends DrawObj {
        constructor(points, pointScale) {
            super();
            this.SetFlags(DrawObjFlag.PatternMode | DrawObjFlag.SecondaryPatternMode);
            this.polyVerts = [];
            this.SetPoints(points, pointScale);
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
        SetPoints(points, pointScale) {
            this.polyVerts = Triangulator.TriangulatePolygon(points, pointScale);
        }

        TestDraw() {
            let canvas = document.getElementById('binpackcanvas');
            let ctx = canvas.getContext('2d');
            ctx.strokeStyle = 'black';
            ctx.fillStyle = 'black'
            ctx.lineWidth = 3;
            ctx.beginPath();

            let cx = canvas.width/2;
            let cy = canvas.height/2;
            let s = 2;

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
                ctx.fillRect(cx + s*nextP.x, cy - s*nextP.y, 10, 10);
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