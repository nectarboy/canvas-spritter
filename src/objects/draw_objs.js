import Mat3 from '../mat3.js';
import Vec2 from '../vec2.js';

class DrawObj {
    constructor() {
        this.mat3 = new Mat3().ToIdentity();
        this.texName = '';
        this.textured = false;
        this.atlasUv0 = new Vec2(0, 0);
        this.atlasUv1 = new Vec2(0, 0);
    };

    SetTexture(atlas, texName) {
        let texBounds = atlas.GetTextureBounds(texName);
        if (texBounds === null)
            return;
        this.atlasUv0.setXY(texBounds.x * iSize, texBounds.y * iSize);
        this.atlasUv1.set(this.atlasUv0).AddXY(texBounds.w * iSize, texBounds.h * iSize);
    }
}

class Sprite extends DrawObj {
    constructor() {
        super();
    };

    WriteVerticesAt(queue, mat3) {
        let iWidth = 1 / this.canvas.width;
        let iHeight = 1 / this.canvas.height;
        
        // These can be pooled / preallocated
        let topLeft = new Vec2(-w/2, h/2).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);
        let topRight = new Vec2(w/2, h/2).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);
        let botLeft = new Vec2(-w/2, -h/2).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);
        let botRight = new Vec2(w/2, -h/2).TransformFromMat3(mat3).ScaleXY(iWidth, iHeight);

        queue.WriteVerticesToStage([
            topRight.x, topRight.y, 1, 0,   this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y,
            botLeft.x, botLeft.y, 0, 1,     this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y,
            topLeft.x, topLeft.y, 0, 0,     this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y,

            botLeft.x, botLeft.y, 0, 1,     this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y,
            topRight.x, topRight.y, 1, 0,   this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y,
            botRight.x, botRight.y, 1, 1,   this.atlasUv0.x, this.atlasUv0.y, this.atlasUv1.x, this.atlasUv1.y
        ], 6);
    }
}

class Poly extends DrawObj {
    constructor(points) {
        super();
        this.tessels = [];
    }

    TessellatePoints(points) {
        this.tessels.length = 0;
    }
}