import Vec2 from './vec2.js';

// A simplified 2D transform with only 1 dimensional scaling, and no shearing.
// Used primarily for game logic.
class Transform {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.rot = 0;
        this.scale = 1;

        this.triRot = 0;
        this.tri = new Vec2();
    };
}

export default Transform;