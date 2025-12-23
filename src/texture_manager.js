class TextureLayer {
    constructor(textureManager, dimension, size) {
        this.textureManager = textureManager;
        this.dimension = dimension;
        this.size = size;

        const device = textureManager.spritter.device;

        this.textureArray = device.createTexture({
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
        this.free
    };
}

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
        const bindGroupLayoutDescriptor = {
            entries: []
        };

        this.textureLayers = [];
        this.totalTextureMemoryFootprint = 0;
        for (let i = 0; i < textureLayers.length; i++) {
            let textureLayer = new TextureLayer(this, textureLayers[i].dimension, textureLayers[i].size);
            this.textureLayers.push(textureLayer);
            this.totalTextureMemoryFootprint += 4 * (textureLayers[i].dimension ** 2) * textureLayers[i].size;

            bindGroupLayoutDescriptor.entries.push({
                binding: this.textureLayerBindOff + i,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { viewDimension: '2d-array' }
            });
        }

        console.log('totalTextureMemoryFootprint', this.totalTextureMemoryFootprint / 0x100000)

        this.bindGroupLayout = device.createBindGroupLayout(bindGroupLayoutDescriptor);

        const bindGroupDescriptor = {
            layout: this.bindGroupLayout,
            entries: []
        };
        for (let i = 0; i < this.textureLayers.length; i++) {
            bindGroupDescriptor.entries.push({
                binding: this.textureLayerBindOff + i,
                resource: this.textureLayers[i].textureArrayView
            });
        }

        this.bindGroup = device.createBindGroup(bindGroupDescriptor);
    };
}

export default TextureManager;