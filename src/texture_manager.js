import Helpers from './helpers.js';

// Holds a texture array of a specified dimension and size, handles loading bitmaps to free textures
class TextureLayer {
    constructor(textureManager, binding, dimension, size) {
        this.textureManager = textureManager;
        this.device = textureManager.spritter.device;
        this.binding = binding;
        this.dimension = dimension;
        this.size = size;

        this.textureArray = this.device.createTexture({
            size: [this.dimension, this.dimension, this.size],
            format: 'rgba8unorm',
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.textureArrayView = this.textureArray.createView({
            dimension: '2d-array'
        });

        this.freeSlotsBitmap = new Uint8Array(Math.ceil(this.size / 8));
        this.freeSlots = new Array(this.size);
        for (let i = 0; i < this.size; i++)
            this.freeSlots[i] = this.size - i - 1;
    };

    LoadBitmap(bitmap) {
        let slot = this.GetTextureSlot();
        this.device.queue.copyExternalImageToTexture(
            { source: bitmap },
            {
                texture: this.textureArray,
                origin: {
                    x: 0,
                    y: 0,
                    z: slot
                }
            },
            {
                width: bitmap.width,
                height: bitmap.height
            }
        );

        return slot;
    }

    GetTextureSlot() {
        if (this.freeSlots.length === 0)
            throw 'No more free slots. what to do?';
        let slot = this.freeSlots.pop();
        this.MarkSlotAsUsed(slot);
        return slot;
    }
    FreeTextureSlot(slot) {
        if (this.SlotIsFree(slot))
            return;
        this.MarkSlotAsFree(slot);
        this.freeSlots.push(slot);
    }
    SlotIsFree(slot) {
        return (this.freeSlotsBitmap[slot >> 3] & (1 << (slot & 7))) === 0;
    }
    MarkSlotAsFree(slot) {
        this.freeSlotsBitmap[slot >> 3] &= ~(1 << (slot & 7));
    }
    MarkSlotAsUsed(slot) {
        this.freeSlotsBitmap[slot >> 3] |= 1 << (slot & 7);
    }

    InitDummyLayer() {
        this.GetTextureSlot(); // mark as full
        // this.textureAr
    }
}

// A list of texture layer configurations
const textureLayers = [
    { // Dummy
        dimension: 1,
        size: 1   
    },
    {
        dimension: 8,
        size: 256
    },
    {
        dimension: 16,
        size: 256
    },
    {
        dimension: 32,
        size: 256
    },
    {
        dimension: 64,
        size: 128
    },
    {
        dimension: 128,
        size: 64
    },
    {
        dimension: 256,
        size: 32
    },
    {
        dimension: 512,
        size: 16
    },
    // TODO: streaming for these? 
    {
        dimension: 1024,
        size: 8
    }
];

// Handles loading textures and binding them to the pipeline
class TextureManager {
    constructor(spritter) {
        this.spritter = spritter;

        const device = spritter.device;

        this.textureLayerBindOff = 0;
        this.samplerBindOff = 9;
        const bindGroupLayoutDescriptor = {
            label: 'texture_manager bind group layout',
            entries: []
        };

        this.textureLayers = [];
        this.dimensionToTextureLayer = new Map();
        this.totalTextureMemoryFootprint = 0;
        for (let i = 0; i < textureLayers.length; i++) {
            let binding = this.textureLayerBindOff + i;
            let textureLayer = new TextureLayer(this, binding, textureLayers[i].dimension, textureLayers[i].size);
            this.textureLayers.push(textureLayer);
            this.dimensionToTextureLayer.set(textureLayers[i].dimension, textureLayer);
            this.totalTextureMemoryFootprint += 4 * (textureLayers[i].dimension ** 2) * textureLayers[i].size; // assuming rgba8

            bindGroupLayoutDescriptor.entries.push({
                binding: binding,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { viewDimension: '2d-array' }
            });
        }

        bindGroupLayoutDescriptor.entries.push({
            binding: this.samplerBindOff,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {}
        });
        this.testSampler = device.createSampler({
            magFilter: 'nearest',
            minFilter: 'linear',
        });

        // Fill dummy texture with 1x1 invisible thing
        this.textureLayers[0].InitDummyLayer();

        this.bindGroupLayout = device.createBindGroupLayout(bindGroupLayoutDescriptor);
        console.log('totalTextureMemoryFootprint MB', this.totalTextureMemoryFootprint / 0x100000);

        const bindGroupDescriptor = {
            label: 'texture_manager bind group',
            layout: this.bindGroupLayout,
            entries: []
        };
        for (let i = 0; i < this.textureLayers.length; i++) {
            bindGroupDescriptor.entries.push({
                binding: this.textureLayerBindOff + i,
                resource: this.textureLayers[i].textureArrayView
            });
        }
        bindGroupDescriptor.entries.push({
            binding: this.samplerBindOff,
            resource: this.testSampler
        })

        this.bindGroup = device.createBindGroup(bindGroupDescriptor);

        this.textureNameToInfo = new Map();
    };

    LoadTextureBitmap(bitmap, name) {
        if (this.textureNameToInfo.has(name))
            return;

        let dimension = Math.max(bitmap.width, bitmap.height, 8);
        let bestDimension = Helpers.CeilToPowerOfTwo(dimension);
        if (bestDimension > 1024)
            throw 'bitmap too big!';

        let textureLayer = this.dimensionToTextureLayer.get(bestDimension);

        let info = {
            width: bitmap.width,
            height: bitmap.height,
            binding: textureLayer.binding,
            textureLayer: textureLayer,
            slot: textureLayer.LoadBitmap(bitmap)
        };
        this.textureNameToInfo.set(name, info);

        return info;
    }

    UnloadTexture(name) {
        if (!this.textureNameToInfo.has(name))
            return;

        let info = this.textureNameToInfo.get(name);
        info.textureLayer.FreeSlot(info.slot);
        this.textureNameToInfo.delete(name);
    }

    GetTextureInfo(name) {
        return this.textureNameToInfo.get(name);
    }
}

export default TextureManager;