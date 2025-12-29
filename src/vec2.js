import Mat3 from './mat3.js';
import { signedAng } from './math.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const UP_Y = 1;

// A 2D vector with a bunch of utility methods.
class Vec2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    };

    static FromAng(ang) {
        return new Vec2(Math.sin(ang * DEG_TO_RAD), Math.cos(ang * DEG_TO_RAD) * UP_Y);
    }

    static NormalOfLine(a, b) {
        const vecNeg90 = new Vec2(-1, 0);
        return new Vec2(b.x - a.x, b.y - a.y).RotateFromUnit(vecNeg90).Normalized();
    }

    Copy() {
        return new Vec2(this.x, this.y);
    }

    Set(vec) {
        this.x = vec.x;
        this.y = vec.y;
        return this;
    }

    ToZero() {
        this.x = 0;
        this.x = 0;
        return this;
    }

    ToUnit() {
        this.x = 0;
        this.y = UP_Y;
        return this;
    }

    SetXY(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    SetFromAng(ang) {
        this.x = Math.sin(ang * DEG_TO_RAD);
        this.y = Math.cos(ang * DEG_TO_RAD) * UP_Y;
        return this;
    }

    Rotate(ang) {
        let sin = -Math.sin(ang * DEG_TO_RAD) * UP_Y;
        let cos = Math.cos(ang * DEG_TO_RAD);
        let x = this.x * cos - this.y * sin;
        let y = this.x * sin + this.y * cos;
        this.x = x;
        this.y = y;
        return this;
    }

    RotateFromUnitCW(vec) {
        let sin = -vec.x * UP_Y;
        let cos = vec.y * UP_Y;
        let x = this.x * cos - this.y * sin;
        let y = this.x * sin + this.y * cos;
        this.x = x;
        this.y = y;
        return this;
    }

    RotateFromUnitCCW(vec) {
        let sin = vec.x * UP_Y;
        let cos = vec.y * UP_Y;
        let x = this.x * cos - this.y * sin;
        let y = this.x * sin + this.y * cos;
        this.x = x;
        this.y = y;
        return this;
    }

    GetRotatedX(ang) {
        let sin = Math.sin(ang * DEG_TO_RAD);
        let cos = Math.cos(ang * DEG_TO_RAD);
        return this.x * cos - this.y * sin;
    }

    GetRotatedY(ang) {
        let sin = Math.sin(ang * DEG_TO_RAD);
        let cos = Math.cos(ang * DEG_TO_RAD);
        return this.x * sin + this.y * cos;
    }

    Ang() {
        return Math.atan2(-this.y * UP_Y, this.x) * RAD_TO_DEG + 90;
    }

    Mag() {
        return Math.sqrt(this.x*this.x + this.y*this.y);
    }

    Normalize() {
        if (this.x === 0 && this.y === 0)
            this.ToUnit();
        let mag_i = 1 / Math.sqrt(this.x * this.x + this.y * this.y);
        this.x *= mag_i;
        this.y *= mag_i;
        return this;
    }

    IsCloseToZero(epsilon = 1.0e-12) {
        return Math.abs(this.x) + Math.abs(this.y) < epsilon;
    }

    Add(vec) {
        this.x += vec.x;
        this.y += vec.y;
        return this;
    }

    AddXY(x, y) {
        this.x += x;
        this.y += y;
        return this;
    }

    Sub(vec) {
        this.x -= vec.x;
        this.y -= vec.y;
        return this;
    }

    Det(vec) {
        return this.x*vec.y - this.y*vec.x;
    }

    Dot(vec) {
        return this.x*vec.x + this.y*vec.y;
    }

    Scale(scale) {
        this.x *= scale;
        this.y *= scale;
        return this;
    }

    ScaleXY(x, y) {
        this.x *= x;
        this.y *= y;
        return this;
    }

    GetAngDiff(vec) {
        return signedAng(-Math.atan2(this.Det(vec), this.Dot(vec)) * RAD_TO_DEG);
    }

    // Apply this, then mat3 (mat3 * this)
    TransformFromMat3(mat3) {
        let x = mat3.m[0] * this.x + mat3.m[3] * this.y + mat3.m[6];
        let y = mat3.m[1] * this.x + mat3.m[4] * this.y + mat3.m[7];
        this.x = x;
        this.y = y;
        return this;
    }
}

export default Vec2;