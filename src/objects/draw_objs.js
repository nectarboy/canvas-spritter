import Mat3 from '../mat3.js';
import DataMat3 from '../data_mat3.js';
import Vec2 from '../vec2.js';
import { PolygonDLL, Triangulator } from '../triangulator.js';

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
    SecondaryTextureAddBlend: 0x20000,  // Simply adds the second texture instead of proper alpha blending
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

    _CleanUp() {
        this._FreeVertices();
    }

    _FreeVertices() {
        this.spritter.drawObjQueue.vertexBlockAllocator.Free(this.vertices);
        this.vertices = null;
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

class Sprite extends DrawObj {
    constructor(spritter, w, h) {
        super(spritter);
        this.w = w;
        this.h = h;
        this.UpdateVertices();
    };

    UpdateVertices() {
        this.vertices = this.spritter.drawObjQueue.vertexBlockAllocator.Allocate(4);
        this.vertices[0].set([0.5, -0.5, 1, 1,  this.w, this.h]); // tr
        this.vertices[1].set([0.5, 0.5, 1, 1,   this.w, -this.h]); // br
        this.vertices[2].set([-0.5, 0.5, 1, 1,  -this.w, -this.h]); // bl
        this.vertices[3].set([-0.5, -0.5, 1, 1, -this.w, this.h]); // tl
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
        this.indices = new INDICES_ARRAY(this.indicesCount);
        for (let i = 0; i < this.indices.length; i++) {
            this.indices[i] = this.GetVertexStart(this.vertices[triangulated.indices[i]]);
        }
    }
}

class Outline extends DrawObj {
    constructor(spritter, polygon, outerD, innerD) {
        super(spritter);
        this.SetOutline(polygon, outerD, innerD);
    };

    SetOutline(polygon, outerD, innerD) {
        console.time('SetOutline');

        const vec90 = Vec2.FromAng(90);

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

        this._FreeVertices();
        this.vertices = this.spritter.drawObjQueue.vertexBlockAllocator.Allocate(dll.size * 4);
        this.indicesCount = dll.size * 6;
        this.indices = new INDICES_ARRAY(this.indicesCount);

        point = dll.start;
        let u = -0.5;
        for (let i = 0; i < dll.size; i++) {
            let next = point.next;
            let normal = point.GetNormal();
            let nextNormal = next.GetNormal();
            let lineNormal = next.val.Copy().Sub(point.val).Normalize().RotateFromUnitCCW(vec90);
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

        this.spritter.drawObjQueue.MarkDirtyVertices(this.vertices);

        console.timeEnd('SetOutline');
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

            this.vertices[i*4 + 0].set([0.5, v, 1, 1,       this.w, y]); // tr
            this.vertices[i*4 + 1].set([0.5, prevV, 1, 1,   this.w, prevY]); // br
            this.vertices[i*4 + 2].set([-0.5, prevV, 1, 1,  -this.w, prevY]); // bl
            this.vertices[i*4 + 3].set([-0.5, v, 1, 1,      -this.w, y]); // tl

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

class DrawObjs {

    constructor(spritter) {
        this.spritter = spritter;
    };

    CreateSprite(w, h) {
        return new Sprite(this.spritter, w, h);
    }

    CreatePoly(points) {
        return new Poly(this.spritter, points); // points must be a Vec2 array
    }

    CreateOutline(polygon, outerD, innerD) {
        return new Outline(this.spritter, polygon, outerD, innerD);
    }

    CreateCurtainSprite(w, h, subdivision, power) {
        return new CurtainSprite(this.spritter, w, h, subdivision, power);
    }

    CreatePerspectiveSprite(w, h) {
        return new PerspectiveSprite(this.spritter, w, h);
    }

}

function IntersectionOfLines(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y) {
    let aA = a2y - a1y;
    let aB = a1x - a2x;
    let aC = a1y * a2x - a1x * a2y;

    let bA = b2y - b1y;
    let bB = b1x - b2x;
    let bC = b1y * b2x - b1x * b2y;

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
        0,1, 2,0,
        0,0, 2,1,
    );
    if (!test1.EqualsXY(1, 0.5))
        throw new Error('failed 1 ' + test1.ToString());
}

UnitTest();

export {
    DrawObjFlag,
    DrawObjs,
};