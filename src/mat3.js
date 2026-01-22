const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// A 3x3 matrix (column-major) representing affine transformations, used primarily for drawobjs.
class Mat3 {
    constructor() {
        this.m = new Float64Array(9);
        this.ToIdentity();
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

    Rotate(ang) {
        let sin = -Math.sin(ang * DEG_TO_RAD); // Clockwise
        let cos = Math.cos(ang * DEG_TO_RAD);
        let m0 = this.m[0] * cos + this.m[3] * sin;
        let m3 = this.m[0] * -sin + this.m[3] * cos;
        let m1 = this.m[1] * cos + this.m[4] * sin;
        let m4 = this.m[1] * -sin + this.m[4] * cos;
        let m2 = this.m[2] * cos + this.m[5] * sin;
        let m5 = this.m[3] * -sin + this.m[5] * cos;
        this.m[0] = m0;
        this.m[1] = m1;
        this.m[2] = m2;
        this.m[3] = m3;
        this.m[4] = m4;
        this.m[5] = m5;
        return this;
    }
    RotateWithTranslation(ang) {
        let sin = -Math.sin(ang * DEG_TO_RAD); // Clockwise
        let cos = Math.cos(ang * DEG_TO_RAD);
        let m0 = this.m[0] * cos + this.m[3] * sin;
        let m3 = this.m[0] * -sin + this.m[3] * cos;
        let m1 = this.m[1] * cos + this.m[4] * sin;
        let m4 = this.m[1] * -sin + this.m[4] * cos;
        let m2 = this.m[2] * cos + this.m[5] * sin;
        let m5 = this.m[3] * -sin + this.m[5] * cos;
        let m6 = this.m[6] * cos - this.m[7] * sin;
        let m7 = this.m[6] * sin + this.m[7] * cos;
        this.m[0] = m0;
        this.m[1] = m1;
        this.m[2] = m2;
        this.m[3] = m3;
        this.m[4] = m4;
        this.m[5] = m5;
        this.m[6] = m6;
        this.m[7] = m7;
        return this;
    }

    Scale(scale) {
        this.m[0] *= scale;
        this.m[1] *= scale;
        this.m[3] *= scale;
        this.m[4] *= scale;
        return this;
    }
    ScaleXY(x, y) {
        this.m[0] *= x;
        this.m[1] *= x;
        this.m[3] *= y;
        this.m[4] *= y;
        return this;
    }
    ScaleWithTranslation(scale) {
        this.ScaleWithTranslationXY(scale, scale);
        return this;
    }
    ScaleWithTranslationXY(x, y) {
        this.m[0] *= x;
        this.m[1] *= x;
        this.m[3] *= y;
        this.m[4] *= y;
        this.m[6] *= x;
        this.m[7] *= y;
        return this;
    }

    TranslateXY(x, y) {
        this.m[6] += x;
        this.m[7] += y;
        return this;
    }
    SetTranslationXY(x, y) {
        this.m[6] = x;
        this.m[7] = y;
        return this;
    }
    ScaleTranslationXY(x, y) {
        this.m[6] *= x;
        this.m[7] *= y;
        return this;
    }
    GetX() {
        return this.m[6];
    }
    GetY() {
        return this.m[7];
    }

    // Apply this, then mat3 (mat3 * this)
    TransformFromMat3(mat3) {
        
    }
}

export default Mat3;