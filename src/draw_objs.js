import Sprite from './draw_objs/sprite.js';
import Poly from './draw_objs/poly.js';
import Outline from './draw_objs/outline.js';
import CurtainSprite from './draw_objs/curtain_sprite.js';
import PerspectiveSprite from './draw_objs/perspective_sprite.js';
import { DrawObjFlag } from './draw_objs/draw_obj.js';

class DrawObjs {
    constructor(spritter) {
        this.spritter = spritter;
    };

    CreateSprite(w, h) {
        return new Sprite(this.spritter, w, h);
    }

    CreatePoly(points) {
        return new Poly(this.spritter, points); // points must be a Vec2 array
    }

    CreateOutline(polygon, outerD, innerD) {
        return new Outline(this.spritter, polygon, outerD, innerD);
    }

    CreateCurtainSprite(w, h, subdivision, power) {
        return new CurtainSprite(this.spritter, w, h, subdivision, power);
    }

    CreatePerspectiveSprite(w, h) {
        return new PerspectiveSprite(this.spritter, w, h);
    }
}

export {
    DrawObjs,
    DrawObjFlag
};