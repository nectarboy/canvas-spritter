import Helpers from './helpers.js';
import BinPacker from './bin_packer.js';

// Holds a giant texture, handles loading in smaller bitmaps and atlasing them
class TextureAtlas {
    constructor(textureManager, binding, dimension) {
        this.textureManager = textureManager;
        this.device = textureManager.spritter.device;
        this.binding = binding;
        this.dimension = dimension;
        this.iDimension = 1 / dimension;

        this.texture = this.device.createTexture({
            size: [this.dimension, this.dimension, 1],
            format: 'rgba8unorm',
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.textureView = this.texture.createView({
            dimension: '2d'
        });

        this.boxes = [];
        this.texInfo = new Map();
    };

    async LoadImageTextures(images) {
        console.time('LoadImageTextures');

        const PAD_TEXTURES = true;

        this.boxes.length = 0;
        this.texInfo.clear();
        for (let i = 0; i < images.length; i++) {
            let image = images[i];
            if (image.img.width + PAD_TEXTURES*2 > this.dimension || image.img.height + PAD_TEXTURES*2 > this.dimension)
                throw 'Image too big!';

            let box = {
                x: -1,
                y: -1,
                w: image.img.width + PAD_TEXTURES*2,
                h: image.img.height + PAD_TEXTURES*2
            };
            this.boxes.push(box);
        }


        BinPacker.PackBoxes(this.boxes, this.dimension);
        BinPacker.DrawBinPack(this.boxes, this.dimension);
        // console.log(this.boxes);

        let maxW = 0;
        let maxH = 0;
        for (let i = 0; i < this.boxes.length; i++) {
            if (this.boxes[i].x + this.boxes[i].w > maxW) maxW = this.boxes[i].x + this.boxes[i].w;
            if (this.boxes[i].y + this.boxes[i].h > maxH) maxH = this.boxes[i].y + this.boxes[i].h;
        }
        let canvas = new OffscreenCanvas(maxW, maxH); // [!] max canvas is 4096 on safari...
        let ctx = canvas.getContext('2d');

        for (let i = 0; i < this.boxes.length; i++) {
            // Fix boxes from padding
            let box = this.boxes[i];
            box.x += PAD_TEXTURES;
            box.y += PAD_TEXTURES;
            box.w -= PAD_TEXTURES * 2;
            box.h -= PAD_TEXTURES * 2;

            let image = images[i];
            if (PAD_TEXTURES) {
                // Corners
                ctx.drawImage(image.img, 0,0,1,1, box.x - 1, box.y - 1, 1, 1);
                ctx.drawImage(image.img, box.w-1,0,1,1, box.x + box.w, box.y - 1, 1, 1);
                ctx.drawImage(image.img, box.w-1,box.h-1,1,1, box.x + box.w, box.y + box.h, 1, 1);
                ctx.drawImage(image.img, 0,box.h-1,1,1, box.x - 1, box.y + box.h, 1, 1);
                // Sides
                ctx.drawImage(image.img, 0,0,box.w,1, box.x, box.y - 1, box.w, 1);
                ctx.drawImage(image.img, box.w-1,0,1,box.h, box.x + box.w, box.y, 1, box.h);
                ctx.drawImage(image.img, 0,box.h-1,box.w,1, box.x, box.y + box.h, box.w, 1);
                ctx.drawImage(image.img, 0,0,1,box.h, box.x - 1, box.y, 1, box.h);
            }
            ctx.drawImage(image.img, box.x, box.y, box.w, box.h);

            this.texInfo.set(image.name, {
                bounds: box,
                fullyOpaque: image.fullyOpaque
            });
        }

        this.device.queue.copyExternalImageToTexture(
            { source: canvas },
            { texture: this.texture },
            {
                width: canvas.width,
                height: canvas.height
            }
        );

        console.timeEnd('LoadImageTextures');
    }

    GetTextureInfo(name) {
        if (!this.texInfo.has(name))
            return null;
        return this.texInfo.get(name);
    }
}

// Handles loading textures and binding them to the pipeline
class TextureManager {
    constructor(spritter) {
        this.spritter = spritter;

        const device = spritter.device;

        this.textureAtlasBindOff = 0;
        this.samplerBindOff = 1;
        const bindGroupLayoutDescriptor = {
            label: 'texture_manager bind group layout',
            entries: []
        };

        this.textureAtlas = new TextureAtlas(this, this.textureAtlasBindOff, 4096);
        bindGroupLayoutDescriptor.entries.push({
            binding: this.textureAtlasBindOff,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: '2d' }
        });

        this.nearestSampler = device.createSampler({
            magFilter: 'nearest',
            minFilter: 'linear',
        });
        this.linearSampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear'
        });
        bindGroupLayoutDescriptor.entries.push({
            binding: this.samplerBindOff,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {}
        });
        bindGroupLayoutDescriptor.entries.push({
            binding: this.samplerBindOff + 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {}
        });

        this.bindGroupLayout = device.createBindGroupLayout(bindGroupLayoutDescriptor);

        const bindGroupDescriptor = {
            label: 'texture_manager bind group',
            layout: this.bindGroupLayout,
            entries: []
        };
        bindGroupDescriptor.entries.push({
            binding: this.textureAtlasBindOff,
            resource: this.textureAtlas.textureView
        });
        bindGroupDescriptor.entries.push({
            binding: this.samplerBindOff,
            resource: this.nearestSampler
        });
        bindGroupDescriptor.entries.push({
            binding: this.samplerBindOff + 1,
            resource: this.linearSampler
        });

        this.bindGroup = device.createBindGroup(bindGroupDescriptor);
    };
}

export default TextureManager;