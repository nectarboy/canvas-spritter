const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const IDENTITY = new Float32Array(12);
IDENTITY.set([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
]);

// A Float32 version of Mat3 that works with existing data, and has padding after every column for alignment.
// Might replace Mat3 itself
class DataMat3 {
    constructor(view = null) {
        this.m = view === null ? new Float32Array(12) : view;
    }

    Copy() {
        let mat3 = new DataMat3(new Float32Array(12));
        mat3.m.set(this.m);
        return mat3;
    }

    Set(mat3) {
        this.m.set(mat3.m);
        return this;
    }

    ToIdentity() {
        this.m.set(IDENTITY);
        return this;
    }

    SetFromTransform(transform) {
        transform.UpdateTriangle();
        let scaledSin = transform.scale * transform.tri.x;
        let scaledCos = transform.scale * transform.tri.y;
        this.m.set([
            scaledCos,
            scaledSin,
            0,
            0,
            -scaledSin,
            scaledCos,
            0,
            0,
            transform.x,
            transform.y,
            1,
            0
        ]);
        return this;
    }

    Rotate(ang) {
        let sin = -Math.sin(ang * DEG_TO_RAD); // Clockwise
        let cos = Math.cos(ang * DEG_TO_RAD);
        let m0 = this.m[0] * cos + this.m[4] * sin;
        let m4 = this.m[0] * -sin + this.m[4] * cos;
        let m1 = this.m[1] * cos + this.m[5] * sin;
        let m5 = this.m[1] * -sin + this.m[5] * cos;
        let m2 = this.m[2] * cos + this.m[6] * sin;
        let m6 = this.m[2] * -sin + this.m[6] * cos;
        this.m[0] = m0;
        this.m[1] = m1;
        this.m[2] = m2;
        this.m[4] = m4;
        this.m[5] = m5;
        this.m[6] = m6;
        return this;
    }
    RotateWithTranslation(ang) {
        let sin = -Math.sin(ang * DEG_TO_RAD); // Clockwise
        let cos = Math.cos(ang * DEG_TO_RAD);
        let m0 = this.m[0] * cos + this.m[4] * sin;
        let m4 = this.m[0] * -sin + this.m[4] * cos;
        let m1 = this.m[1] * cos + this.m[5] * sin;
        let m5 = this.m[1] * -sin + this.m[5] * cos;
        let m2 = this.m[2] * cos + this.m[6] * sin;
        let m6 = this.m[2] * -sin + this.m[6] * cos;
        let m8 = this.m[8] * cos - this.m[9] * sin;
        let m9 = this.m[8] * sin + this.m[9] * cos;
        this.m[0] = m0;
        this.m[1] = m1;
        this.m[2] = m2;
        this.m[4] = m4;
        this.m[5] = m5;
        this.m[6] = m6;
        this.m[8] = m8;
        this.m[9] = m9;
        return this;
    }
    ReverseRotation() {
        this.m[1] = -this.m[1];
        this.m[4] = -this.m[4];
    }

    Scale(scale) {
        this.m[0] *= scale;
        this.m[1] *= scale;
        this.m[4] *= scale;
        this.m[5] *= scale;
        return this;
    }
    ScaleXY(x, y) {
        this.m[0] *= x;
        this.m[1] *= x;
        this.m[4] *= y;
        this.m[5] *= y;
        return this;
    }
    ScaleWithTranslation(scale) {
        this.ScaleWithTranslationXY(scale, scale);
        return this;
    }
    ScaleWithTranslationXY(x, y) {
        this.m[0] *= x;
        this.m[1] *= x;
        this.m[4] *= y;
        this.m[5] *= y;
        this.m[8] *= x;
        this.m[9] *= y;
        return this;
    }



    TranslateXY(x, y) {
        this.m[8] += x;
        this.m[9] += y;
        return this;
    }
    SetTranslationXY(x, y) {
        this.m[8] = x;
        this.m[9] = y;
        return this;
    }
    ScaleTranslationXY(x, y) {
        this.m[8] *= x;
        this.m[9] *= y;
        return this;
    }
    GetX() {
        return this.m[8];
    }
    GetY() {
        return this.m[9];
    }
    SetX(x) {
        this.m[8] = x;
        return this;
    }
    SetY(y) {
        this.m[9] = y;
        return this;
    }

    // Apply this, then mat3 (mat3 * this)
    TransformFromMat3(mat3) {
        
    }
}

export default DataMat3;