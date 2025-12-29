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
        uvMat3.Rotate(30);

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
            queue.verticesStage.set([i], off + 4);
            queue.verticesStage.set([i], off + 9);
            queue.verticesStage.set([i], off + 14);
            queue.verticesStage.set([i], off + 19);
            queue.verticesStage.set([i], off + 24);
            queue.verticesStage.set([i], off + 29);
            queue.verticesCount += 6;

            // queue.BufferDrawObjVertices([
            //     topRight.x, topRight.y,     topRightUv.x, topRightUv.y,     i,
            //     botLeft.x, botLeft.y,       botLeftUv.x, botLeftUv.y,       i,
            //     topLeft.x, topLeft.y,       topLeftUv.x, topLeftUv.y,       i,

            //     botLeft.x, botLeft.y,       botLeftUv.x, botLeftUv.y,       i,
            //     topRight.x, topRight.y,     topRightUv.x, topRightUv.y,     i,
            //     botRight.x, botRight.y,     botRightUv.x, botRightUv.y,     i
            // ], 6);
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