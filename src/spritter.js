import EngineConsts from './engine_consts.js';
import TextureManager from './texture_manager.js';
import DrawObjQueue from './draw_obj_queue.js';
import Vec2 from './vec2.js';
import { DrawObjFlag, DrawObjs } from './objects/draw_objs.js';
import GetSpritterImage from './spritter_image.js';

async function fetchShader(path, dependencies) {
    let requires = [];

    let wgsl = (await (await fetch(path, { cache: 'no-store' })).text()).split("\n");

    for (let dependencyWgsl of dependencies) {
        wgsl = dependencyWgsl.split("\n").concat(wgsl);
    }

    for (let i = 0; i < wgsl.length; i++) {
        let line = wgsl[i];
        if (line.startsWith("requires")) {
            requires.push(line);
            wgsl.splice(i, 1);
            i--;
        }
    }

    wgsl = requires.concat(wgsl);

    return wgsl.join("\n");
}

const drawObjWgsl = await (await fetch('./src/wgsl/draw_obj.wgsl', { cache: 'no-store' })).text();
const drawObjFlagsWgsl = await (await fetch('./src/wgsl/draw_obj_flags.wgsl', { cache: 'no-store' })).text();
const vsWgsl = await fetchShader('./src/wgsl/vs.wgsl', [drawObjWgsl, drawObjFlagsWgsl]);
const fsWgsl = await fetchShader('./src/wgsl/fs.wgsl', [drawObjWgsl, drawObjFlagsWgsl]);

let spikeballShape;

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

        this.opaquePipeline = device.createRenderPipeline({
            label: 'opaque pipeline',
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
                        // blend: {
                        //     color: {
                        //         operation: 'add',
                        //         srcFactor: 'src-alpha',
                        //         dstFactor: 'one-minus-src-alpha'
                        //     },
                        //     alpha: {
                        //         operation: 'add',
                        //         srcFactor: 'src-alpha',
                        //         dstFactor: 'one-minus-src-alpha'
                        //     }
                        // }
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
            label: 'transparent pipeline',
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
                depthCompare: 'greater'
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
            await GetSpritterImage('src/assets/test.png', 'test'),
            await GetSpritterImage('src/assets/test2.png', 'test2'),
            await GetSpritterImage('src/assets/terrain.png', 'terrain'),
            await GetSpritterImage('src/assets/bunny.png', 'bunny'),
            await GetSpritterImage('src/assets/atlas_test.png', 'atlas_test'),
            await GetSpritterImage('src/assets/mask.png', 'mask'),
            await GetSpritterImage('src/assets/mask2.png', 'mask2'),
            await GetSpritterImage('src/assets/background.png', 'background', true),
            await GetSpritterImage('src/assets/water.png', 'water')
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
        let flip = (this.tick % 60) >= 30;
        let flop = (this.tick % 120) >= 60;

        let backgroundSprite = new DrawObjs.Sprite(this.canvas.width, this.canvas.height);
        backgroundSprite.SetTextureAtlas(this.textureManager.textureAtlas);
        backgroundSprite.SetTexture('background');
        this.drawObjQueue.BufferDrawobj(backgroundSprite, 0);

        let testSprite = new DrawObjs.Sprite(128, 128);
        testSprite.SetTextureAtlas(this.textureManager.textureAtlas);
        testSprite.SetTexture('test');
        testSprite.SetSecondaryTexture('water');
        testSprite.SetFlags(DrawObjFlag.PatternMode | DrawObjFlag.SeeThroughMode | DrawObjFlag.SecondaryPatternMode | DrawObjFlag.SecondarySeeThroughMode | DrawObjFlag.FilterSecondaryTexture);
        testSprite.tex2Alpha[0] = 0;
        testSprite.tintColor.set([0.5, 0.5, 0.5, 1]);
        // testSprite.thresholdLowerColor.a = 0.95;
        // testSprite.SetMaskMode(true);
        testSprite.SetDisplacementMode(true);
        testSprite.mat3.TranslateXY(Math.sin(now) * 100, Math.sin(now) * 50);
        testSprite.mat3.ScaleXY((Math.sin(now) + 1) / 2 + 1, 2);
        // testSprite.mat3.Rotate(this.tick);

        testSprite.texMat3.TranslateXY(this.tick / 3, this.tick / 3);
        testSprite.texMat3.ScaleWithTranslationXY(0.33, 0.33);
        // testSprite.tex2Mat3.TranslateXY(this.tick, this.tick);
        testSprite.tex2Mat3.ScaleWithTranslationXY(0.25, 0.25);
        // testSprite.tex2Mat3.Rotate(this.tick / 10);
        this.drawObjQueue.BufferDrawobj(testSprite, 1);

        // Stress tester
        for (let i = 0; i < 10000 - 100; i++) {
            // testPoly.mat3.TranslateXY((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
            // this.drawObjQueue.BufferDrawobj(testPoly, i);

            testSprite.tintColor[0] = Math.random();
            testSprite.tintColor[1] = Math.random();
            testSprite.tintColor[2] = Math.random();
            testSprite.mat3.Rotate(1);
            testSprite.mat3.TranslateXY((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
            this.drawObjQueue.BufferDrawobj(testSprite, 0);
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

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setBindGroup(0, this.textureManager.bindGroup);
        passEncoder.setBindGroup(1, this.drawObjQueue.storageBindGroup);
        passEncoder.setVertexBuffer(0, this.drawObjQueue.vertexBuffer);
        passEncoder.setIndexBuffer(this.drawObjQueue.indexBuffer, 'uint32');
        passEncoder.setPipeline(this.opaquePipeline);
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