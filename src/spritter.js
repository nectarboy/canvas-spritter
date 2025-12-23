import EngineConsts from './engine_consts.js';
import TextureManager from './texture_manager.js';
import Vec2 from './vec2.js';

const vs = `
struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) fragUv : vec2f,
    @location(1) fragColor : vec4f
}   

@vertex
fn main(
    @builtin(vertex_index) VertexIndex : u32,
    @location(0) position : vec2f,
    @location(1) uv : vec2f
) -> VertexOutput {
    var out : VertexOutput;
    out.position = vec4f(position, 0.0, 1.0);
    out.fragUv = uv;
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
@group(0) @binding(9) var sam : sampler;

@fragment
fn main(
    @location(0) fragUv: vec2f,
    @location(1) fragColor: vec4f
) -> @location(0) vec4f {
    var pix = textureSample(tex256, sam, fragUv, 0);
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
        this.vertexBufferEntrySize = 4;
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
                            }
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

        this.vertexStaging.set([
            topRight.x, topRight.y, 1, 0,
            botLeft.x, botLeft.y, 0, 1,
            topLeft.x, topLeft.y, 0, 0,

            botLeft.x, botLeft.y, 0, 1,
            topRight.x, topRight.y, 1, 0,
            botRight.x, botRight.y, 1, 1
        ], this.vertexStagingCount * this.vertexBufferEntrySize);
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