import EngineConsts from './engine_consts.js';
import TextureManager from './texture_manager.js';
import DrawObjQueue from './draw_obj_queue.js';
import Vec2 from './vec2.js';
import DrawObjs from './objects/draw_objs.js';

const vs = await (await fetch('./src/shaders/vs.wgsl')).text();
const fs = await (await fetch('./src/shaders/fs.wgsl')).text();

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
                    code: vs
                }),
                buffers: [
                    this.drawObjQueue.vertexBufferDescriptor
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
    };

    async init() {
        let bitmaps = [
            await this.loadImageBitmap('src/test.png', 'test'),
            await this.loadImageBitmap('src/terrain.png', 'terrain'),
            await this.loadImageBitmap('src/bunny.png', 'bunny'),
            await this.loadImageBitmap('src/atlas_test.png', 'atlas_test')
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

    bufferQuad(x, y, w, h, rot) {
        let rotVec = Vec2.FromAng(rot);
        let iWidth = 1 / this.canvas.width;
        let iHeight = 1 / this.canvas.height;
        let topLeft = new Vec2(-w/2, h/2).RotateFromUnitCW(rotVec).AddXY(x, y).ScaleXY(iWidth, iHeight);
        let topRight = new Vec2(w/2, h/2).RotateFromUnitCW(rotVec).AddXY(x, y).ScaleXY(iWidth, iHeight);
        let botLeft = new Vec2(-w/2, -h/2).RotateFromUnitCW(rotVec).AddXY(x, y).ScaleXY(iWidth, iHeight);
        let botRight = new Vec2(w/2, -h/2).RotateFromUnitCW(rotVec).AddXY(x, y).ScaleXY(iWidth, iHeight);

        const texName = rotVec.x > 0 ? 'test' : 'test'; 
        let texBounds = this.textureManager.textureAtlas.GetTextureBounds(texName);
        let iSize = 1 / this.textureManager.textureAtlas.dimension;
        const uv0 = new Vec2(texBounds.x * iSize, texBounds.y * iSize);
        const uv1 = uv0.Copy().AddXY(texBounds.w * iSize, texBounds.h * iSize);

        this.vertexStaging.set([
            topRight.x, topRight.y, 1, 0,   uv0.x, uv0.y, uv1.x, uv1.y,
            botLeft.x, botLeft.y, 0, 1,     uv0.x, uv0.y, uv1.x, uv1.y,
            topLeft.x, topLeft.y, 0, 0,     uv0.x, uv0.y, uv1.x, uv1.y,

            botLeft.x, botLeft.y, 0, 1,     uv0.x, uv0.y, uv1.x, uv1.y,
            topRight.x, topRight.y, 1, 0,   uv0.x, uv0.y, uv1.x, uv1.y,
            botRight.x, botRight.y, 1, 1,   uv0.x, uv0.y, uv1.x, uv1.y
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

        // this.bufferQuad(-canvas.width / 4, 0, 256, 256, 0);
        // this.bufferQuad(-canvas.width / 2, 0, 206, 256, now * 100);

        // for (let i = 0; i < 1; i++)
        //     this.bufferQuad(canvas.width * Math.sin(now + i*.1), canvas.height * Math.cos(now + i*.1), 128, 128, 0);


        let testSprite = new DrawObjs.Sprite(128, 128);
        testSprite.SetTexture(this.textureManager.textureAtlas, 'test');
        // testSprite.mat3.TranslateXY(Math.sin(this.tick / 100) * 100, 0);
        testSprite.mat3.ScaleXY(1, 1);
        testSprite.mat3.Rotate(this.tick);
        this.drawObjQueue.BufferDrawobj(testSprite, 0);

        // Stress tester
        // for (let i = 0; i < 1; i++) {
        //     testSprite.mat3.Rotate(1);
        //     testSprite.mat3.TranslateXY(Math.random() - 0.5, Math.random() - 0.5);
        //     this.drawObjQueue.BufferDrawobj(testSprite, 0);
        // }
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


        this.drawObjQueue.PushDrawObjBufferToVertices();
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