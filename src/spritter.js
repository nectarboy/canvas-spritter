import EngineConsts from './engine_consts.js';
import TextureManager from './texture_manager.js';
import DrawObjQueue from './draw_obj_queue.js';
import Vec2 from './vec2.js';
import { DrawObjFlag, DrawObjs } from './objects/draw_objs.js';

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

        this.tick = 0;

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

        this.depthStencilTexture = this.device.createTexture({
            size: [canvas.width, canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });

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
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'greater'
            },
            primitive: {
                topology: 'triangle-list',
                frontFace: 'cw'
            }
        });

        this.transparentPipeline = device.createRenderPipeline({
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
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: false,
                depthCompare: 'greater-equal'
            },
            primitive: {
                topology: 'triangle-list',
                frontFace: 'cw'
            }
        });

        // performance measuring
        this.gpuMicroS = -1;

        this.perfQuerySet = device.createQuerySet({
            type: 'timestamp',
            count: 2
        });
        this.perfResolveBuffer = device.createBuffer({
            size: this.perfQuerySet.count * 8,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });
        this.perfResultBuffer = device.createBuffer({
            size: this.perfResolveBuffer.size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
    };

    async init() {
        let images = [
            await this.GetImage('src/assets/test.png', 'test'),
            await this.GetImage('src/assets/test2.png', 'test2'),
            await this.GetImage('src/assets/terrain.png', 'terrain'),
            await this.GetImage('src/assets/bunny.png', 'bunny'),
            await this.GetImage('src/assets/atlas_test.png', 'atlas_test'),
            await this.GetImage('src/assets/mask.png', 'mask'),
            await this.GetImage('src/assets/mask2.png', 'mask2'),
            await this.GetImage('src/assets/background.png', 'background')
        ];

        console.log('images:', images);

        await this.textureManager.textureAtlas.LoadImageTextures(images);
    }

    GetImage(url, name = '') {
        return new Promise((resolve, reject) => {
            let image = {
                name: name,
                img: new Image()
            };
            image.img.src = url;

            image.img.onload = () => resolve(image);
            image.img.onerror = (e) => reject(e);
        });
    }

    flushVertexStaging() {
        this.vertexStagingCount = 0;
    }

    doStuff() {        
        let now = new Date() / 1600;

        let backgroundSprite = new DrawObjs.Sprite(480, 360);
        backgroundSprite.transparent = true;
        backgroundSprite.SetTextureAtlas(this.textureManager.textureAtlas);
        backgroundSprite.SetTexture('background');
        this.drawObjQueue.BufferDrawobj(backgroundSprite, 0);

        let testSprite = new DrawObjs.Sprite(128, 128);
        // testSprite.transparent = true;
        testSprite.SetTextureAtlas(this.textureManager.textureAtlas);
        testSprite.SetTexture('test');
        testSprite.SetSecondaryTexture('mask2');
        testSprite.SetFlags(DrawObjFlag.FilterSecondaryTexture);
        testSprite.tex2Alpha = 1;
        // testSprite.tintColor = {r:1, g: 0, b:0, a:1};
        // testSprite.thresholdLowerColor.a = 0.95;
        testSprite.SetMaskMode(true);
        testSprite.SetDisplacementMode(true);
        testSprite.mat3.TranslateXY(Math.sin(now) * 100, 0);
        // testSprite.mat3.ScaleXY(1, 1);
        // testSprite.mat3.Rotate(this.tick);
        this.drawObjQueue.BufferDrawobj(testSprite, 1);

        let testPerspective = new DrawObjs.PerspectiveSprite();
        testPerspective.topLeft.SetXY(-100 * .5, 100 * .5);
        testPerspective.topRight.SetXY(100 * .5, 100);
        testPerspective.botRight.SetXY(100, -100);
        testPerspective.botLeft.SetXY(-100, -100);
        testPerspective.UpdatePerspectiveWeights();

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
        // testPoly.TestDraw();
        testPoly.SetTextureAtlas(this.textureManager.textureAtlas);
        testPoly.SetTexture('terrain');
        testPoly.mat3.TranslateXY(-Math.sin(now) * 100, 0);
        testPoly.mat3.ScaleXY(1, 1);
        // testPoly.mat3.Rotate(this.tick);
        // this.drawObjQueue.BufferDrawobj(testPoly, 0);

        // Stress tester
        for (let i = 0; i < 0; i++) {
            // testSprite.mat3.Rotate(1);
            testSprite.mat3.TranslateXY((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
            this.drawObjQueue.BufferDrawobj(testSprite, i);
        }
    }

    async draw() {
        let start = performance.now();

        this.doStuff();
        this.drawObjQueue.PushDrawObjsToStageBuffers();
        this.drawObjQueue.UploadStageBuffersToBuffers();

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
            ],
            depthStencilAttachment: {
                view: this.depthStencilTexture.createView(),
                depthLoadOp: 'clear',
                depthClearValue: 0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            },
            timestampWrites: {
                querySet: this.perfQuerySet,
                beginningOfPassWriteIndex: 0,
                endOfPassWriteIndex: 1
            }
        };

        console.log(this.drawObjQueue.opaqueVertices, this.drawObjQueue.transparentVertices);

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.textureManager.bindGroup);
        passEncoder.setBindGroup(1, this.drawObjQueue.storageBindGroup);
        passEncoder.setVertexBuffer(0, this.drawObjQueue.vertexBuffer);
        passEncoder.draw(this.drawObjQueue.opaqueVertices);
        passEncoder.setPipeline(this.transparentPipeline);
        passEncoder.draw(this.drawObjQueue.transparentVertices, 1, this.drawObjQueue.opaqueVertices);
        passEncoder.end();


        commandEncoder.resolveQuerySet(this.perfQuerySet, 0, this.perfQuerySet.count, this.perfResolveBuffer, 0);
        if (this.perfResultBuffer.mapState === 'unmapped') {
            commandEncoder.copyBufferToBuffer(this.perfResolveBuffer, 0, this.perfResultBuffer, 0, this.perfResultBuffer.size);
        }

        this.device.queue.submit([commandEncoder.finish()]);

        // performance measurement
        if (this.tick % 30 === 0) {
            if (this.perfResultBuffer.mapState === 'unmapped') {
                await this.perfResultBuffer.mapAsync(GPUMapMode.READ);
                let times = new BigUint64Array(this.perfResultBuffer.getMappedRange());
                this.gpuMicroS = Number(times[1] - times[0]) / 1000;
                this.perfResultBuffer.unmap();
            }
        }

        this.drawObjQueue.Flush();
        this.tick++;

        let ms = (performance.now() - start);
        document.getElementById('status').textContent = 'js ms: ' + ms.toFixed(2) + (this.gpuMicroS === -1 ? '' : '\ngpu µs: ' + this.gpuMicroS.toFixed(2));
    }
}

export default Spritter;