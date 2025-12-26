// A 3x3 matrix (column-major) representing 2D transformations, used primarily for drawobjs.
class Mat3 {
    constructor() {
        this.m = new Float32Array([
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ]);
    }

    Copy() {
        let mat3 = new Mat3();
        mat3.m.set(this.m);
        return mat3;
    }

    ToIdentity() {
        this.m.set([
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ]);
        return this;
    }

    ScaleXY(x, y) {
        this.m[0] *= x;
        this.m[1] *= x;
        this.m[3] *= y;
        this.m[4] *= y;
    }
    ScaleAndScaleTranslationXY(x, y) {
        this.m[0] *= x;
        this.m[1] *= x;
        this.m[3] *= y;
        this.m[4] *= y;
        this.m[6] *= x;
        this.m[7] *= y;
    }

    TranslateXY(x, y) {
        this.m[6] += x;
        this.m[7] += y;
    }
    SetTranslationXY(x, y) {
        this.m[6] = x;
        this.m[7] = y;
        return this;
    }
    ScaleTranslationXY(x, y) {
        this.m[6] *= x;
        this.m[7] *= y;
    }
    GetX() {
        return this.m[6];
    }
    GetY() {
        return this.m[7];
    }

    SetFromTransform(transform) {
        transform.UpdateTriangle();
        let scaledSin = transform.scale * transform.tri.x;
        let scaledCos = transform.scale * transform.tri.y;
        this.m.set([
            scaledCos,
            scaledSin,
            0,
            -scaledSin,
            scaledCos,
            0,
            transform.x,
            transform.y,
            1
        ]);
        return this;
    }

    // Apply this, then mat3 (mat3 * this)
    TransformFromMat3(mat3) {

    }
}