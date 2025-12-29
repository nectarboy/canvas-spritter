// Angles (in bearing), if _fast causes errors, try using normal func.
function signedRad(rad) {
    rad %= PI2;
    return rad - PI2*(rad > PI) + PI2*(rad < -PI);
}
function signedAng(ang) {
    ang %= 360;
    return ang - 360*(ang > 180) + 360*(ang < -180);
}
function signedRad_fast(rad) {
    return rad - PI2*(rad > PI);
}
function signedAng_fast(ang) {
    return ang - 360*(ang > 180);
}
// TODO: name these unsignedRad and unsignedAng
function unsignedRad(rad) {
    rad %= PI2;
    return rad + PI2*(rad < 0);
}
function unsignedAng(ang) {
    ang %= 360;
    return ang + 360*(ang < 0);
    // return ((ang % 360) + 360) % 360;
}
function unsignedRad_fast(rad) {
    return rad + PI2*(rad < 0);
}
function unsignedAng_fast(ang) {
    return ang + 360*(ang < 0);
}

// function getRad(x1,y1,x2,y2) {
//     var rad = Math.atan2(y2-y1, x2-x1) - PIh;
//     return rad + PI2*(rad < 0);
// }
// function getAng(x1,y1,x2,y2) {
//     return getRad(x1,y1,x2,y2)*RAD_TO_DEG; // bruh
// }
function getRad(x,y) {
    var rad = Math.atan2(y,x) - PIh;
    return rad + PI2*(rad < 0);
}
function getAng(x,y) {
    return getRad(x,y)*RAD_TO_DEG; // bruh
}
function getAngDiff(ang1, ang2) {
    var diff = (ang1 - ang2);
    if (diff < 0)
        diff = -diff;
    if (diff > 180)
        diff -= 360;
    if (diff < 0)
        diff = -diff;

    return diff;
}
function getAngDiffSigned(ang1, ang2) {
    var diff = (ang2 - ang1);
    // if (diff < 0)
    //     diff = -diff;
    if (diff > 180)
        diff -= 360;
    if (diff < -180)
        diff += 360;
    // if (diff < 0)
    //     diff = -diff;
    return diff;

    // return (destinationAngle - sourceAngle) % 180;
}
function getAngTransition(ang1, ang2, range) {
    var diff = (ang1 - ang2);
    if (diff > 180)
        ang1 -= 360;
    else if (diff < -180)
        ang1 += 360;

    var between = ang1 + (ang2 - ang1)*range;
    if (between < 0)
        between += 180*2;

    return between;
}
function getRadTransition(rad1, rad2, range) {
    var diff = (rad1 - rad2);
    if (diff > PI)
        rad1 -= PI2;
    else if (diff < -PI)
        rad1 += PI2;

    var between = rad1 + (rad2 - rad1)*range;
    if (between < 0)
        between += PI2;

    return between;
}
function getAngBetween(ang1, ang2) {
    return getAngTransition(ang1, ang2, 0.5);
}
// TODO: am i doing these correct ??? can the values be more useful ?
function getRadRotX(x,y, sinRad,cosRad) {
     return x*cosRad - y*sinRad;
}
function getRadRotY(x,y, sinRad,cosRad) {
    return x*sinRad + y*cosRad;
}
// PIVOT FUNCTIONS, used for rotating platforms, or positioning dynamic vector surfaces relative to gravity
// x and y is coords of pivot, r is radius from pivot, rad is angle in radians starting from bottom aka bearing
function getPivotX(r, rad) {
    return r*Math.cos(rad + PIh);
}
function getPivotY(r, rad) {
    return r*Math.sin(rad + PIh);
}

// Interpolation
function getLinInt(a,b, t) {
    return a + (b-a)*t;
}
function getSinInt(a,b, t) {
    return b + (a - b)*(0.5*(Math.sin(t*PI + PIh)+1));
}

// Vectors
function getDistFrom(x1,y1,x2,y2) {
    var rise = (y1-y2);
    var run = (x2-x1);
    return Math.sqrt(run*run + rise*rise);
}
function getSlope(x1,y1,x2,y2) {
    var rise = (y1-y2);
    var run = (x2-x1);
    // if (run === 0)
    //     return rise < 0 ? -Infinity : Infinity;
    return rise / run;
}
function getVecTransition(x0,y0,x1,y1, range) {
    if (range > 1)
        range = 1;
    var sin = 0.5*(Math.sin(range*PI + PIh)+1);

    var ret = {
        x: x1 + (x0 - x1)*sin,
        y: y1 + (y0 - y1)*sin
    };
    return ret;
}

// Vector coordinate manipulation with angles
// These are pretty costly
function getVecX(x, y, ang) {
    // console.log(1);
    ang = unsignedAng(ang);
    var rad = ang * DEG_TO_RAD;

    var v = Math.sqrt(x*x + y*y);
    var vRad = Math.atan2(y, -x) - PIh;

    return v * Math.sin(rad + vRad);
}
function getVecY(x, y, ang) {
    ang = unsignedAng(ang);
    var rad = ang * DEG_TO_RAD;

    var v = Math.sqrt(x*x + y*y);
    var vRad = Math.atan2(y, -x) - PIh;

    return v * Math.cos(rad + vRad);
}
function addVec(x,y, mag, ang) {
    ang = unsignedAng(ang);
    var rad = ang * DEG_TO_RAD;

    var v = Math.sqrt(x*x + y*y);
    var vRad = Math.atan2(y, -x) - PIh;

    this.vx += mag * Math.sin(-rad);
    this.vy += mag * Math.cos(rad);
    this.updateVec();

    // console.log(x,y);
}

// MISC
function unsignedMod(val, mod) {
    val %= mod;
    return val + mod*(val < 0);
}

export {
    signedAng
};