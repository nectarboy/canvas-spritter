class TextureLayer {
    constructor(textureManager, dimension, size) {
        this.textureManager = textureManager;
        this.dimension = dimension;
        this.size = size;

        this.free
    };
}

const textureLayers = [
    { // Dummy
        dimension: 1,
        size: 1   
    },
    {
        dimension: 16,
        size: 128
    },
    {
        dimension: 32,
        size: 128
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
    },
    {
        dimension: 2048,
        size: 4
    }
];

// Handles loading textures and binding them to the pipeline
class TextureManager {
    constructor(spritter) {
        this.spritter = spritter;

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

        this.bindGroupLayout = this.spritter.device.createBindGroupLayout(bindGroupLayoutDescriptor);

        // this.bindGroup = this.device.createBindGroup({
        //     layout: this.bindGroupLayout,
        //     entries: [
        //         {
        //             binding: 0,
        //             resource: this.sampler
        //         },
        //         {
        //             binding: 1,
        //             resource: this.testTexture.createView()
        //         }
        //     ]
        // });
    };
}

export default TextureManager;