import EngineConsts from './engine_consts.js';
import TextureManager from './texture_manager.js';
import DrawObjQueue from './draw_obj_queue.js';
import Vec2 from './vec2.js';
import DrawObjs from './objects/draw_objs.js';

async function fetchShader(path, dependencies) {
    let wgsl = await (await fetch(path, { cache: 'no-store' })).text();
    for (let dependencyWgsl of dependencies) {
        wgsl = dependencyWgsl + wgsl + "\n\n";
    }
    return wgsl;
}

const drawObjWgsl = await (await fetch('./src/wgsl/draw_obj.wgsl', { cache: 'no-store' })).text();
const drawObjFlagsWgsl = await (await fetch('./src/wgsl/draw_obj_flags.wgsl', { cache: 'no-store' })).text();
const vsWgsl = await fetchShader('./src/wgsl/vs.wgsl', [drawObjWgsl, drawObjFlagsWgsl]);
const fsWgsl = await fetchShader('./src/wgsl/fs.wgsl', [drawObjWgsl, drawObjFlagsWgsl]);

class Spritter {
    constructor(canvas, device) {
        globalThis.spritter = this;

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
        this.drawObjQueue = new DrawObjQueue(this);

        this.tick = 0;
        this.aspectRatio = this.canvas.width / this.canvas.height;

        this.pipelineLayout = device.createPipelineLayout({
            label: 'pipeline layout',
            bindGroupLayouts: [this.textureManager.bindGroupLayout, this.drawObjQueue.storageBindGroupLayout]
        });

        this.pipeline = device.createRenderPipeline({
            label: 'spritter pipeline',
            layout: this.pipelineLayout,
            vertex: {
                module: device.createShaderModule({
                    label: 'vs',
                    code: vsWgsl
                }),
                buffers: [
                    this.drawObjQueue.vertexBufferDescriptor
                ]
            },
            fragment: {
                module: device.createShaderModule({
                    label: 'fs',
                    code: fsWgsl
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
                topology: 'triangle-list',
                frontFace: 'cw'
            }
        });
    };

    async init() {
        let bitmaps = [
            await this.loadImageBitmap('src/assets/test.png', 'test'),
            await this.loadImageBitmap('src/assets/test2.png', 'test2'),
            await this.loadImageBitmap('src/assets/terrain.png', 'terrain'),
            await this.loadImageBitmap('src/assets/bunny.png', 'bunny'),
            await this.loadImageBitmap('src/assets/atlas_test.png', 'atlas_test'),
            await this.loadImageBitmap('src/assets/mask.png', 'mask')
        ];

        console.log('bitmaps:', bitmaps);

        this.textureManager.textureAtlas.LoadTextureBitmaps(bitmaps);
    }

    async loadImageBitmap(url, name = '') {
        if (name === '')
            throw 'please provide a valid texture name';
        let blob = await (await fetch(url)).blob();
        let bitmap = await createImageBitmap(blob);
        let bitmapDescriptor = {
            name: name,
            bitmap: bitmap
        };
        return bitmapDescriptor;
    }

    flushVertexStaging() {
        this.vertexStagingCount = 0;
    }

    doStuff() {        
        let now = new Date() / 500;

        let testSprite = new DrawObjs.Sprite(128, 128);
        testSprite.SetTextureAtlas(this.textureManager.textureAtlas);
        testSprite.SetTexture('test');
        testSprite.SetSecondaryTexture('mask');
        testSprite.mat3.TranslateXY(Math.sin(this.tick / 100) * 100, 0);
        // testSprite.mat3.ScaleXY(1, 1);
        // testSprite.mat3.Rotate(this.tick);
        this.drawObjQueue.BufferDrawobj(testSprite, 1);

        let testPoly = new DrawObjs.Poly([
            new Vec2(-2, 0),
            new Vec2(-1, 1),
            new Vec2(1, 1),
            new Vec2(2, 0),
            new Vec2(3, 0),
            new Vec2(2, -0.25),
            new Vec2(1, -1),
            new Vec2(-1, -1)
        ], 100);
        testPoly.TestDraw();
        testPoly.SetTextureAtlas(this.textureManager.textureAtlas);
        testPoly.SetTexture('terrain');
        testPoly.mat3.TranslateXY(-Math.sin(this.tick / 100) * 100, 0);
        testPoly.mat3.ScaleXY(1, 1);
        // testPoly.mat3.Rotate(this.tick);
        // this.drawObjQueue.BufferDrawobj(testPoly, 0);

        // Stress tester
        for (let i = 0; i < 1; i++) {
            testPoly.mat3.Rotate(1);
            testPoly.mat3.TranslateXY(Math.random() - 0.5, Math.random() - 0.5);
            this.drawObjQueue.BufferDrawobj(testPoly, 0);
        }
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


        this.drawObjQueue.PushDrawObjsToStageBuffers();
        this.drawObjQueue.UploadStageBuffersToBuffers();

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.textureManager.bindGroup);
        passEncoder.setBindGroup(1, this.drawObjQueue.storageBindGroup);
        passEncoder.setVertexBuffer(0, this.drawObjQueue.vertexBuffer);
        passEncoder.draw(this.drawObjQueue.verticesCount);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);

        this.drawObjQueue.Flush();
        this.tick++;
    }
}

export default Spritter;