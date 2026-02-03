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
    SignedDisplacementMode: 0x100,      // Make displacement signed (with center being a value of 0.5)
    PatternMode: 0x200,                 // Use texture's real size instead of DrawObj size
    SecondaryPatternMode: 0x400,        // Use secondary texture as pattern
    SeeThroughMode: 0x800,              // Produces a see-through effect, only for use with pattern mode
    SecondarySeeThroughMode: 0x1000,    // Produces a see-through effect, only for use with pattern mode
    FlipTextureX: 0x2000,
    FlipTextureY: 0x4000,
    FlipSecondaryTextureX: 0x8000,
    FlipSecondaryTextureY: 0x10000,
    SecondaryTextureAddBlend: 0x20000    // Simply adds the second texture instead of proper alpha blending
};

const DATA_ARRAY = Float32Array; // Float32Array makes copying data to buffers MUCH faster than Float64Array
const DATA_BYTES = DATA_ARRAY.BYTES_PER_ELEMENT;
const INDICES_ARRAY = Uint32Array;
const WHITE = new DATA_ARRAY(4);
WHITE.set([1, 1, 1, 1]);

class DrawObj {
    constructor(spritter) {
        this.spritter = spritter;

        this.released = false;
        this.data = new DATA_ARRAY(64);
        this.vertices = null;
        this.indices = new INDICES_ARRAY(0);
        this.indicesCount = 0;

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

        this.texPosX = 0;
        this.texPosY = 0;
        this.texPos = new DATA_ARRAY(this.data.buffer, 48 * DATA_BYTES, 2);
        this.texSize = new DATA_ARRAY(this.data.buffer, 50 * DATA_BYTES, 2);
        this.texIsFullyOpaque = false;

        this.tex2PosX = 0;
        this.tex2PosY = 0;
        this.tex2Pos = new DATA_ARRAY(this.data.buffer, 52 * DATA_BYTES, 2);
        this.tex2Size = new DATA_ARRAY(this.data.buffer, 54 * DATA_BYTES, 2);
        this.tex2IsFullyOpaque = false;

        // The opacity of tex2 being overlayed on top of tex1. If 0.0, only tex1 will show as normal.
        this.tex2Alpha = new DATA_ARRAY(this.data.buffer, 56 * DATA_BYTES, 1);

        this.atlas = null;
        this.atlasDimension = new DATA_ARRAY(this.data.buffer, 57 * DATA_BYTES, 1);
        this.iAtlasDimension = new DATA_ARRAY(this.data.buffer, 58 * DATA_BYTES, 1);

        this.displacementStrength = new DATA_ARRAY(this.data.buffer, 59 * DATA_BYTES, 1);
        this.displacementStrength[0] = 0;

        // Set by the queue, do not use this value!
        this.ordering = new DATA_ARRAY(this.data.buffer, 60 * DATA_BYTES, 1);

        this.flags = new Uint32Array(this.data.buffer, 61 * DATA_BYTES, 1);
        this.ResetFlags();

        this.transparent = true;
        this.posOffset = new Vec2(0, 0);
    };

    Release() {
        if (this.released)
            return;

        this.released = true;
        this.spritter.drawObjQueue.QueueReleasedDrawObj(this);
    }

    IsFullyOpaque() {
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
    }

    SetFlags(flags) {
        this.flags[0] |= flags;
    }

    ClearFlags(flags) {
        this.flags[0] &= ~flags;
    }

    ResetFlags() {
        this.flags[0] &= DrawObjFlag.UseTexture | DrawObjFlag.UseSecondaryTexture; // Keep
        this.flags[0] |= DrawObjFlag.RepeatTexture | DrawObjFlag.RepeatSecondaryTexture; // Default
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
        this.texPosX = tex.bounds.x;
        this.texPosY = tex.bounds.y;
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
        this.tex2PosX = tex.bounds.x;
        this.tex2PosY = tex.bounds.y;
        this.tex2Pos[0] = tex.bounds.x;
        this.tex2Pos[1] = tex.bounds.y;
        this.tex2Size[0] = tex.bounds.w;
        this.tex2Size[1] = tex.bounds.h;
        this.tex2IsFullyOpaque = tex.fullyOpaque;
        this.SetFlags(DrawObjFlag.UseSecondaryTexture);
    }

    SetSubTexture(x, y, w, h) {
        this.texPos[0] = this.texPosX + x;
        this.texPos[1] = this.texPosY + y;
        this.texSize[0] = w;
        this.texSize[1] = h;
    }

    SetSecondarySubTexture(x, y, w, h) {
        this.tex2Pos[0] = this.tex2PosX + x;
        this.tex2Pos[1] = this.tex2PosY + y;
        this.tex2Size[0] = w;
        this.tex2Size[1] = h;
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

    SetDisplacement(displacementStrength) {
        this.displacementStrength[0] = displacementStrength;
    }

    GetVertexStart(vertex) {
        return vertex.byteOffset / this.spritter.drawObjQueue.vertexEntryByteSize;
    }
}

class Sprite extends DrawObj {
    constructor(spritter, w, h) {
        super(spritter);
        this.w = w;
        this.h = h;
        this.UpdateVertices();
    };

    UpdateVertices() {
        this.vertices = this.spritter.drawObjQueue.vertexBlockAllocator.Allocate(4);
        this.vertices[0].set([0.5, -0.5, 1, 0,  this.w, this.h]); // tr
        this.vertices[1].set([0.5, 0.5, 1, 0,   this.w, -this.h]); // br
        this.vertices[2].set([-0.5, 0.5, 1, 0,  -this.w, -this.h]); // bl
        this.vertices[3].set([-0.5, -0.5, 1, 0, -this.w, this.h]); // tl
        this.spritter.drawObjQueue.MarkDirtyVertices(this.vertices);

        this.indicesCount = 6;
        this.indices = new INDICES_ARRAY(this.indicesCount);
        this.indices.set([
            this.GetVertexStart(this.vertices[0]),
            this.GetVertexStart(this.vertices[1]),
            this.GetVertexStart(this.vertices[2]),
            this.GetVertexStart(this.vertices[0]),
            this.GetVertexStart(this.vertices[2]),
            this.GetVertexStart(this.vertices[3]),
        ]);
    }
}

class Poly extends DrawObj {
    constructor(spritter, points, pointScale) {
        super(spritter);
        this.SetFlags(DrawObjFlag.PatternMode | DrawObjFlag.SecondaryPatternMode);
        this.SetPoints(points, pointScale);
    }

    SetPoints(points, pointScale) {
        this.spritter.drawObjQueue.vertexBlockAllocator.Free(this.vertices);
        let triangulated = Triangulator.TriangulatePolygon(points, pointScale);
        this.UpdateVertices(triangulated);
    }

    UsePointsOfPoly(poly) {
        if (poly === null || this.vertices === poly.vertices)
            return;

        this.spritter.drawObjQueue.vertexBlockAllocator.Free(this.vertices);
        this.vertices = poly.vertices;
        this.indices = poly.vertices;
    }

    UpdateVertices(triangulated) {
        this.vertices = this.spritter.drawObjQueue.vertexBlockAllocator.Allocate(triangulated.vertices.length);
        for (let i = 0; i < triangulated.vertices.length; i++) {
            let vertex = triangulated.vertices[i];
            this.vertices[i].set([vertex.x, -vertex.y, 1, 0,  vertex.x, vertex.y]);
        }
        this.spritter.drawObjQueue.MarkDirtyVertices(this.vertices);

        // TODO: optimize
        this.indicesCount = triangulated.indices.length;
        this.indices = new INDICES_ARRAY(this.indicesCount);
        for (let i = 0; i < this.indices.length; i++) {
            this.indices[i] = this.GetVertexStart(this.vertices[triangulated.indices[i]]);
        }
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
        for (let i = 0; i < this.indices.length; i++) {
            // abysmal but it works
            let vertexX = new Float32Array(this.vertices[0].buffer)[this.indices[i] * this.spritter.drawObjQueue.vertexEntrySize + 4];
            let vertexY = new Float32Array(this.vertices[0].buffer)[this.indices[i] * this.spritter.drawObjQueue.vertexEntrySize + 5];
            let nextVertexX = new Float32Array(this.vertices[0].buffer)[this.indices[Math.floor(i / 3)*3 + ((i + 1) % 3)] * this.spritter.drawObjQueue.vertexEntrySize + 4];
            let nextVertexY = new Float32Array(this.vertices[0].buffer)[this.indices[Math.floor(i / 3)*3 + ((i + 1) % 3)] * this.spritter.drawObjQueue.vertexEntrySize + 5];

            if ((i % 3) === 0) {
                ctx.stroke();
                ctx.closePath();
                ctx.beginPath();
                ctx.moveTo(cx + s*vertexX, cy - s*vertexY);
            }
            
            ctx.lineTo(cx + s*nextVertexX, cy - s*nextVertexY);
            ctx.fillRect(cx + s*nextVertexX, cy - s*nextVertexY, 10, 10);
        }
        ctx.stroke();
        ctx.closePath();

    }
}

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
        this.indices = new INDICES_ARRAY(this.indicesCount);

        const func = x => Math.pow(x, this.power);

        let prevV = 0.5;
        let prevY = -0.5 * this.h * 2;
        for (let i = 0; i < this.subdivision; i++) {
            let v = -(i + 1) / this.subdivision + 0.5;
            let y = (func((i + 1) / this.subdivision) - 0.5) * this.h * 2;

            this.vertices[i*4 + 0].set([0.5, v, 1, 0,       this.w, y]); // tr
            this.vertices[i*4 + 1].set([0.5, prevV, 1, 0,   this.w, prevY]); // br
            this.vertices[i*4 + 2].set([-0.5, prevV, 1, 0,  -this.w, prevY]); // bl
            this.vertices[i*4 + 3].set([-0.5, v, 1, 0,      -this.w, y]); // tl

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

class DrawObjs {

    constructor(spritter) {
        this.spritter = spritter;
    };

    CreateSprite(w, h) {
        return new Sprite(this.spritter, w, h);
    }

    CreatePoly(points, scale) {
        return new Poly(this.spritter, points, scale); // points must be a Vec2 array
    }

    CreateCurtainSprite(w, h, subdivision, power) {
        return new CurtainSprite(this.spritter, w, h, subdivision, power);
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

        GetVerticesCount() {
            return 6;
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