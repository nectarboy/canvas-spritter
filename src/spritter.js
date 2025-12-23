import EngineConsts from './engine_consts.js';
import TextureManager from './texture_manager.js';
import Vec2 from './vec2.js';

const vs = `
struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) fragUv : vec2f,
    @location(1) fragColor : vec4f,
    @location(2) @interpolate(flat) texBinding : u32,
    @location(3) @interpolate(flat) texLayer : u32
}   

@vertex
fn main(
    @builtin(vertex_index) VertexIndex : u32,
    @location(0) position : vec2f,
    @location(1) uv : vec2f,
    @location(2) texBinding : u32,
    @location(3) texLayer : u32
) -> VertexOutput {
    var out : VertexOutput;
    out.position = vec4f(position, 0.0, 1.0);
    out.fragUv = uv;
    out.texBinding = texBinding;
    out.texLayer = texLayer;
    if ((VertexIndex & 1) == 1) {
        out.fragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
    else {
        out.fragColor = vec4(1.0, 0.0, 1.0, 1.0);
    }
    return out;
}
`;

const fs = `
// ... is there a cleaner way of doing this or
@group(0) @binding(0) var texDummy : texture_2d_array<f32>;
@group(0) @binding(1) var tex8 : texture_2d_array<f32>;
@group(0) @binding(2) var tex16 : texture_2d_array<f32>;
@group(0) @binding(3) var tex32 : texture_2d_array<f32>;
@group(0) @binding(4) var tex64 : texture_2d_array<f32>;
@group(0) @binding(5) var tex128 : texture_2d_array<f32>;
@group(0) @binding(6) var tex256 : texture_2d_array<f32>;
@group(0) @binding(7) var tex512 : texture_2d_array<f32>;
@group(0) @binding(8) var tex1024 : texture_2d_array<f32>;
@group(0) @binding(9) var testSampler : sampler;

// this kind of sucks... maybe a giant atlas approach is better... could even be an array of atlases... just better to have one texture binding
fn sampleFromTexture(texBinding : u32, sam : sampler, uv : vec2<f32>, texLayer : u32) -> vec4<f32> {
    var dx = dpdx(uv);
    var dy = dpdy(uv);
    switch texBinding {
        case 0: { return textureSampleGrad(texDummy, sam, uv, texLayer, dx, dy); }
        case 1: { return textureSampleGrad(tex8, sam, uv, texLayer, dx, dy); }
        case 2: { return textureSampleGrad(tex16, sam, uv, texLayer, dx, dy); }
        case 3: { return textureSampleGrad(tex32, sam, uv, texLayer, dx, dy); }
        case 4: { return textureSampleGrad(tex64, sam, uv, texLayer, dx, dy); }
        case 5: { return textureSampleGrad(tex128, sam, uv, texLayer, dx, dy); }
        case 6: { return textureSampleGrad(tex256, sam, uv, texLayer, dx, dy); }
        case 7: { return textureSampleGrad(tex512, sam, uv, texLayer, dx, dy); }
        case 8: { return textureSampleGrad(tex1024, sam, uv, texLayer, dx, dy); }
        default: { return textureSampleGrad(texDummy, sam, uv, texLayer, dx, dy); }
    }
}

@fragment
fn main(
    @location(0) fragUv: vec2f,
    @location(1) fragColor: vec4f,
    @location(2) @interpolate(flat) texBinding : u32,
    @location(3) @interpolate(flat) texLayer : u32
) -> @location(0) vec4f {

    var pix = sampleFromTexture(texBinding, testSampler, fragUv, texLayer);
    // if (pix.a == 0.0) {
        // discard;
    // }
    return pix;
}
`;

class Spritter {
    constructor(canvas, device) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('webgpu');
        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.ctx.configure({
            device: device,
            format: this.canvasFormat,
            // alphaMode: 'premultiplied'
        });

        this.device = device;
        this.encoder = device.createCommandEncoder();

        this.textureManager = new TextureManager(this);

        this.aspectRatio = this.canvas.width / this.canvas.height;

        this.vertexBufferEntries = 1024;
        this.vertexStagingCount = 0;
        this.vertexStaging = new Float32Array(this.vertexBufferEntries);
        this.vertexStagingUint32 = new Uint32Array(this.vertexStaging.buffer);
        this.vertexBufferEntrySize = 6;
        this.vertexBufferEntryBytes = this.vertexBufferEntrySize * this.vertexStaging.BYTES_PER_ELEMENT;
        this.vertexBuffer = device.createBuffer({
            size: this.vertexStaging.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.pipelineLayout = device.createPipelineLayout({
            label: 'pipeline layout',
            bindGroupLayouts: [this.textureManager.bindGroupLayout]
        });

        this.pipeline = device.createRenderPipeline({
            label: 'spritter pipeline',
            layout: this.pipelineLayout,
            vertex: {
                module: device.createShaderModule({
                    label: 'vs',
                    code: vs
                }),
                buffers: [
                    {
                        arrayStride: this.vertexBufferEntryBytes,
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x2'
                            },
                            {
                                shaderLocation: 1,
                                offset: 4 * 2,
                                format: 'float32x2'
                            },
                            {
                                shaderLocation: 2,
                                offset: 4 * 4,
                                format: 'uint32'
                            },
                            {
                                shaderLocation: 3,
                                offset: 4 * 5,
                                format: 'uint32'
                            },
                        ]
                    }
                ]
            },
            fragment: {
                module: device.createShaderModule({
                    label: 'fs',
                    code: fs
                }),
                targets: [
                    {
                        format: this.canvasFormat,
                        blend: {
                            color: {
                                operation: 'add',
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha'
                            },
                            alpha: {
                                operation: 'add',
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha'
                            }
                        }
                    }
                ]
            },
            primitive: {
                topology: 'triangle-list'
            }
        });

        this.testTexture = null;
    };

    async init() {
        let bitmap = await this.loadImageBitmap('src/test.png');  
        let textureInfo = this.textureManager.LoadTextureBitmap(bitmap, 'test');
        console.log(textureInfo);

        let bitmap2 = await this.loadImageBitmap('src/terrain.png');
        this.textureManager.LoadTextureBitmap(bitmap2, 'test2');
    }

    async loadImageBitmap(url) {
        let blob = await (await fetch(url)).blob();
        let bitmap = await createImageBitmap(blob);
        return bitmap;
    }

    bufferQuad(x, y, w, h, rot) {
        let rotVec = Vec2.FromAng(rot);
        let iWidth = 1 / this.canvas.width;
        let iHeight = 1 / this.canvas.height;
        let topLeft = new Vec2(-w/2, h/2).RotateFromUnitCW(rotVec).AddXY(x, y).ScaleXY(iWidth, iHeight);
        let topRight = new Vec2(w/2, h/2).RotateFromUnitCW(rotVec).AddXY(x, y).ScaleXY(iWidth, iHeight);
        let botLeft = new Vec2(-w/2, -h/2).RotateFromUnitCW(rotVec).AddXY(x, y).ScaleXY(iWidth, iHeight);
        let botRight = new Vec2(w/2, -h/2).RotateFromUnitCW(rotVec).AddXY(x, y).ScaleXY(iWidth, iHeight);

        const texBinding = 2;
        const texLayer = 0;

        const off = this.vertexStagingCount * this.vertexBufferEntrySize;
        this.vertexStaging.set([ topRight.x, topRight.y, 1, 0 ], off);
        this.vertexStaging.set([ botLeft.x, botLeft.y, 0, 1 ], off + 6);
        this.vertexStaging.set([ topLeft.x, topLeft.y, 0, 0 ], off + 12);
        this.vertexStaging.set([ botLeft.x, botLeft.y, 0, 1 ], off + 18);
        this.vertexStaging.set([ topRight.x, topRight.y, 1, 0 ], off + 24);
        this.vertexStaging.set([ botRight.x, botRight.y, 1, 1 ], off + 30);
        this.vertexStagingUint32.set([ texBinding, texLayer ], off + 4);
        this.vertexStagingUint32.set([ texBinding, texLayer ], off + 10);
        this.vertexStagingUint32.set([ texBinding, texLayer ], off + 16);
        this.vertexStagingUint32.set([ texBinding, texLayer ], off + 22);
        this.vertexStagingUint32.set([ texBinding, texLayer ], off + 28);
        this.vertexStagingUint32.set([ texBinding, texLayer ], off + 34);
        
        this.vertexStagingCount += 6;
    }

    flushVertexStaging() {
        this.vertexStagingCount = 0;
    }

    doStuff() {
        let now = new Date() / 500;

        // this.vertexStaging.set([
        //     0.0 + Math.random(), 0.5,
        //     -0.5, -0.5,
        //     0.5, -0.5,
        // ], 0);
        // this.vertexStagingCount = 3;

        this.bufferQuad(-canvas.width / 4, 0, 256, 256, 0);
        this.bufferQuad(-canvas.width / 2, 0, 256, 256, now * 100);

        this.bufferQuad(canvas.width * Math.sin(now), canvas.height * Math.cos(now), 128, 128, 0);
    }

    draw() {
        this.doStuff();

        const canvasTextureView = this.ctx.getCurrentTexture().createView();
        const commandEncoder = this.device.createCommandEncoder();
        const renderPassDescriptor = {
            colorAttachments: [
                {
                    view: canvasTextureView,
                    clear: [0, 0, 0, 0],
                    loadOp: 'clear',
                    storeOp: 'store'
                }
            ]
        };

        this.device.queue.writeBuffer(
            this.vertexBuffer,
            0,
            this.vertexStaging.buffer,
            this.vertexStaging.byteOffset,
            this.vertexStagingCount * this.vertexBufferEntryBytes
        );

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.textureManager.bindGroup);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.draw(this.vertexStagingCount);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);

        this.flushVertexStaging();
    }
}

export default Spritter;