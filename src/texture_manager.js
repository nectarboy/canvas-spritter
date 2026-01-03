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
        this.boxMap = new Map();
    };

    LoadTextureBitmaps(bitmapDescriptors) {
        const PAD_TEXTURES = true;

        this.boxes.length = 0;
        this.boxMap.clear();
        for (let i = 0; i < bitmapDescriptors.length; i++) {
            let bitmap = bitmapDescriptors[i].bitmap;
            if (bitmap.width + PAD_TEXTURES*2 > this.dimension || bitmap.height + PAD_TEXTURES*2 > this.dimension)
                throw 'bitmap too big!';

            let box = {
                x: -1,
                y: -1,
                w: bitmap.width + PAD_TEXTURES*2,
                h: bitmap.height + PAD_TEXTURES*2
            };
            this.boxes.push(box);
            this.boxMap.set(bitmapDescriptors[i].name, box);
        }

        BinPacker.PackBoxes(this.boxes, this.dimension);
        BinPacker.DrawBinPack(this.boxes, this.dimension);
        console.log(this.boxes);

        for (let i = 0; i < this.boxes.length; i++) {
            let bitmap = bitmapDescriptors[i].bitmap;

            // TODO: there has to be a better way to do ts
            let offs;
            if (PAD_TEXTURES) {
                offs = [
                    { x: 0, y: 0 },
                    { x: 2, y: 0 },
                    { x: 2, y: 2 },
                    { x: 0, y: 2 },
                    { x: 1, y: 0 },
                    { x: 2, y: 1 },
                    { x: 1, y: 2 },
                    { x: 0, y: 1 },
                    { x: 1, y: 1 }
                ];
            }
            else {
                offs = [{ x: 0, y: 0 }];
            }

            for (let off of offs) {
                this.device.queue.copyExternalImageToTexture(
                    { source: bitmap },
                    {
                        texture: this.texture,
                        origin: {
                            x: this.boxes[i].x + off.x,
                            y: this.boxes[i].y + off.y
                        }
                    },
                    {
                        width: bitmap.width,
                        height: bitmap.height
                    }
                );
            }

            // Fix boxes from padding
            this.boxes[i].x += PAD_TEXTURES;
            this.boxes[i].y += PAD_TEXTURES;
            this.boxes[i].w -= PAD_TEXTURES * 2;
            this.boxes[i].h -= PAD_TEXTURES * 2;
        }
    }

    GetTextureBounds(name) {
        if (!this.boxMap.has(name))
            return null;
        return this.boxMap.get(name);
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

        this.testSampler = device.createSampler({
            magFilter: 'nearest',
            minFilter: 'linear',
        });
        bindGroupLayoutDescriptor.entries.push({
            binding: this.samplerBindOff,
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
            resource: this.testSampler
        });

        this.bindGroup = device.createBindGroup(bindGroupDescriptor);
    };
}

export default TextureManager;