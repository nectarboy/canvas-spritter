import Mat3 from '../mat3.js';
import Vec2 from '../vec2.js';

class DrawObj {
    constructor() {
        this.mat3 = new Mat3().ToIdentity();
        this.texName = '';
        this.textured = false;
        this.texW = 0;
        this.texH = 0;
        this.atlasUv0 = new Vec2(0, 0);
        this.atlasUv1 = new Vec2(0, 0);
    };

    SetTexture(atlas, texName) {
        let iSize = 1 / atlas.dimension;
        let texBounds = atlas.GetTextureBounds(texName);
        if (texBounds === null)
            return;
        this.texW = texBounds.w;
        this.texH = texBounds.h;
        this.atlasUv0.SetXY(texBounds.x * iSize, texBounds.y * iSize);
        this.atlasUv1.Set(this.atlasUv0).AddXY(texBounds.w * iSize, texBounds.h * iSize);
    }

    BufferVerticesAt(queue, mat3) {}
}

class DrawObjs {

    static Sprite = class Sprite extends DrawObj {
        constructor(w, h) {
            super();
            this.w = w;
            this.h = h;
        };

        BufferVerticesAt(queue, mat3) {
            let iWidth = 1 / queue.spritter.canvas.width;
            let iHeight = 1 / queue.spritter.canvas.height;
            let halfW = this.w;
            let halfH = this.h;

            // These can be pooled / preallocated
            const uvMat3 = new Mat3();
            uvMat3.TranslateXY(queue.spritter.tick / this.texW / 10, queue.spritter.tick / this.texH / 10);
            uvMat3.Rotate(-queue.spritter.tick);
            let topLeftUv = new Vec2(-0.5, -0.5).TransformFromMat3(uvMat3).AddXY(0.5, 0.5);
            let topRightUv = new Vec2(0.5, -0.5).TransformFromMat3(uvMat3).AddXY(0.5, 0.5);
            let botLeftUv = new Vec2(-0.5, 0.5).TransformFromMat3(uvMat3).AddXY(0.5, 0.5);
            let botRightUv = new Vec2(0.5, 0.5).TransformFromMat3(uvMat3).AddXY(0.5, 0.5);

            let topLeft = new Vec2(-halfW, halfH).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);
            let topRight = new Vec2(halfW, halfH).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);
            let botLeft = new Vec2(-halfW, -halfH).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);
            let botRight = new Vec2(halfW, -halfH).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);

            queue.BufferVertices([
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