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

        queue.BufferDrawObjData([
            mat3.m[0], mat3.m[1], mat3.m[2],
            mat3.m[3], mat3.m[4], mat3.m[5],
            mat3.m[6], mat3.m[7], mat3.m[8],

            uvMat3.m[0], uvMat3.m[1], uvMat3.m[2],
            uvMat3.m[3], uvMat3.m[4], uvMat3.m[5],
            uvMat3.m[6], uvMat3.m[7], uvMat3.m[8],

            this.atlasDimension,
            this.iAtlasDimension,

            this.atlasPos.x, this.atlasPos.y,
            this.atlasSize.x, this.atlasSize.y
        ]);
    }

    BufferVerticesAt(queue, mat3, i) {}
}

class DrawObjs {

    static Sprite = class Sprite extends DrawObj {
        constructor(w, h) {
            super();
            this.w = w;
            this.h = h;
        };

        BufferVerticesAt(queue, mat3, i) {
            let iWidth = 1 / queue.spritter.canvas.width;
            let iHeight = 1 / queue.spritter.canvas.height;
            let halfW = this.w;
            let halfH = this.h;

            // These can be pooled / preallocated
            const uvMat3 = new Mat3();
            let topLeftUv = new Vec2(-0.5, -0.5).TransformFromMat3(uvMat3).AddXY(0.5, 0.5);
            let topRightUv = new Vec2(0.5, -0.5).TransformFromMat3(uvMat3).AddXY(0.5, 0.5);
            let botLeftUv = new Vec2(-0.5, 0.5).TransformFromMat3(uvMat3).AddXY(0.5, 0.5);
            let botRightUv = new Vec2(0.5, 0.5).TransformFromMat3(uvMat3).AddXY(0.5, 0.5);

            let topLeft = new Vec2(-halfW, halfH).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);
            let topRight = new Vec2(halfW, halfH).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);
            let botLeft = new Vec2(-halfW, -halfH).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);
            let botRight = new Vec2(halfW, -halfH).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);

            queue.BufferDrawObjVertices([
                topRight.x, topRight.y,     topRightUv.x, topRightUv.y,     this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y,
                botLeft.x, botLeft.y,       botLeftUv.x, botLeftUv.y,       this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y,
                topLeft.x, topLeft.y,       topLeftUv.x, topLeftUv.y,       this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y,

                botLeft.x, botLeft.y,       botLeftUv.x, botLeftUv.y,       this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y,
                topRight.x, topRight.y,     topRightUv.x, topRightUv.y,     this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y,
                botRight.x, botRight.y,     botRightUv.x, botRightUv.y,     this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y
            ], 6);
        }
    }

    static Poly = class Poly extends DrawObj {
        constructor(points) {
            super();
            this.tessels = [];
        }

        TessellatePoints(points) {
            this.tessels.length = 0;
        }
    }

}

export default DrawObjs;