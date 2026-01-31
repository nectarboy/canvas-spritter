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
const opaqueCuttingFragWgsl = await fetchShader('./src/wgsl/opaque_cutting.frag.wgsl', [drawObjWgsl, drawObjFlagsWgsl]);

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

        const MAX_MASK_LAYERS = 8;
        this.maxMaskLayers = MAX_MASK_LAYERS;

        this.textureManager = new TextureManager(this);
        this.drawObjQueue = new DrawObjQueue(this);
        this.drawObjs = new DrawObjs(this);

        this.depthStencilTexture = this.device.createTexture({
            size: [canvas.width, canvas.height],
            format: "depth24plus-stencil8",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });

        this.pipelineLayout = device.createPipelineLayout({
            label: 'pipeline layout',
            bindGroupLayouts: [this.textureManager.bindGroupLayout, this.drawObjQueue.bindGroupLayout]
        });

        this.stencilSetPipelines = new Array(MAX_MASK_LAYERS);
        this.opaquePipelines = new Array(1 << MAX_MASK_LAYERS);
        this.transparentPipelines = new Array(1 << MAX_MASK_LAYERS);
        this.opaquePipelines.fill(null);
        this.transparentPipelines.fill(null);

        this.vsModule = device.createShaderModule({
            label: 'vs',
            code: vsWgsl
        });
        this.fsModule = device.createShaderModule({
            label: 'fs',
            code: fsWgsl
        }); 
        this.opaqueCuttingFragModule = device.createShaderModule({
            label: 'opaque cutting frag',
            code: opaqueCuttingFragWgsl
        }); 

        // Generate a stencil setter pipeline for each mask
        for (let i = 0; i < MAX_MASK_LAYERS; i++) {
            this.stencilSetPipelines[i] = device.createRenderPipeline({
                label: 'stencil set pipeline #' + i,
                layout: this.pipelineLayout,
                vertex: {
                    module: this.vsModule,
                    buffers: [
                        this.drawObjQueue.pullerBufferDescriptor
                    ]
                },
                fragment: {
                    module: this.opaqueCuttingFragModule,
                    targets: [
                        {
                            format: this.canvasFormat,
                            writeMask: 0
                        }
                    ]
                },
                depthStencil: {
                    format: 'depth24plus-stencil8',
                    depthWriteEnabled: false,
                    depthCompare: 'always',
                    stencilFront: {
                        passOp: 'replace',
                        compare: 'always'
                    },
                    stencilWriteMask: (1 << i)
                },
                primitive: {
                    topology: 'triangle-list',
                    frontFace: 'cw'
                }
            });
        }

        // Generate opaque and transparent pipelines for most mask combinations.
        // Because making a lot of pipelines incurs an ABYSMALLY BAD overhead up to 10 seconds,
        // we make only a few of the combinations (lower layers are guaranteed, higher layers will need to be made on the fly.)
        for (let i = 0; i < Math.min(16, 1 << MAX_MASK_LAYERS); i++) {
            this.opaquePipelines[i] = this.CreateNormalPipeline(true, i);
            this.transparentPipelines[i] = this.CreateNormalPipeline(false, i);
        }

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

    CreateNormalPipeline(opaque, index) {
        return this.device.createRenderPipeline({
            label: (opaque ? 'opaque pipeline #' : 'transparent pipeline #') + index,
            layout: this.pipelineLayout,
            vertex: {
                module: this.vsModule,
                buffers: [
                    this.drawObjQueue.pullerBufferDescriptor
                ]
            },
            fragment: {
                module: this.fsModule,
                targets: [
                    {
                        format: this.canvasFormat,
                        blend: (opaque ? (void 0) : {
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
                        })
                    }
                ]
            },
            depthStencil: {
                format: 'depth24plus-stencil8',
                depthWriteEnabled: opaque,
                depthCompare: 'greater',
                stencilFront: {
                    passOp: 'keep',
                    compare: 'equal'
                },
                stencilReadMask: index
            },
            primitive: {
                topology: 'triangle-list',
                frontFace: 'cw'
            }
        });
    }

    GetOpaquePipeline(index) {
        if (this.opaquePipelines[index] === null) {
            this.opaquePipelines[index] = this.CreateNormalPipeline(true, index);
        }
        return this.opaquePipelines[index];
    }

    GetTransparentPipeline(index) {
        if (this.transparentPipelines[index] === null) {
            this.transparentPipelines[index] = this.CreateNormalPipeline(false, index);
        }
        return this.transparentPipelines[index];
    }

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
            await GetSpritterImage('src/assets/water.png', 'water'),
            await GetSpritterImage('src/assets/mariofire.png', 'mariofire')
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

        let backgroundSprite = this.drawObjs.CreateSprite(this.canvas.width, this.canvas.height);
        backgroundSprite.SetTextureAtlas(this.textureManager.textureAtlas);
        backgroundSprite.SetTexture('background');
        this.drawObjQueue.BufferDrawobj(backgroundSprite, 0);

        // if (this.tick === 0)
            // console.log(backgroundSprite.pullers);

        let testSprite = this.drawObjs.CreateSprite(128, 128);
        testSprite.SetTextureAtlas(this.textureManager.textureAtlas);
        testSprite.SetTexture('atlas_test');
        testSprite.SetSecondaryTexture('water');
        testSprite.SetFlags(DrawObjFlag.PatternMode | DrawObjFlag.SeeThroughMode | DrawObjFlag.FilterSecondaryTexture | (DrawObjFlag.FlipTextureX * flip));
        testSprite.tex2Alpha[0] = 0;
        testSprite.displacementStrength[0] = Math.sin(now);
        // testSprite.tintColor.set([0.5, 0.5, 0.5, 1]);
        // testSprite.thresholdLowerColor.a = 0.95;
        // testSprite.SetMaskMode(true);
        testSprite.SetDisplacement(1);
        testSprite.mat3.TranslateXY(Math.sin(now) * 100, Math.sin(now) * 50);
        testSprite.mat3.ScaleXY((Math.sin(now) + 1) / 2 + 1, 2);
        // testSprite.mat3.Rotate(this.tick);
        // testSprite.texMat3.TranslateXY(this.tick / 3, this.tick / 3);
        testSprite.texMat3.ScaleWithTranslation(4 / (this.tick*.05 + 1));
        // testSprite.tex2Mat3.TranslateXY(this.tick, this.tick);
        // testSprite.tex2Mat3.ScaleWithTranslationXY(1, 0.25);
        // testSprite.tex2Mat3.Rotate(this.tick / 10);
        // this.drawObjQueue.BufferDrawobj(testSprite, 1);

        // let curtainSprite = new DrawObjs.CurtainSprite(128, 128, 20, 0.5);
        // curtainSprite.SetTextureAtlas(this.textureManager.textureAtlas);
        // curtainSprite.SetTexture('test');
        // curtainSprite.texMat3.TranslateXY(0, -this.tick * 0.01);
        // // curtainSprite.SetFlags(DrawObjFlag.PatternMode);
        // this.drawObjQueue.BufferDrawobj(curtainSprite, 1);

        let fireMario = this.drawObjs.CreateSprite(32, 40);
        fireMario.SetTextureAtlas(this.textureManager.textureAtlas);
        fireMario.SetTexture('mariofire');
        fireMario.SetSubTexture([0, 1, 2, 1, 0, 3, 4, 3][Math.round(this.tick / 4) % 8] * 32, 0, 32, 40);
        fireMario.mat3.Scale(3);
        fireMario.SetFlags(DrawObjFlag.FlipTextureX * flip | DrawObjFlag.FlipTextureY * flop);
        this.drawObjQueue.BufferDrawobj(fireMario, 1);

        let testLine = this.drawObjs.CreateSprite(1, 128);
        testLine.tintColor.set([0, 0, 0, 1]);
        testLine.mat3.Rotate(Math.round(this.tick / 15) * 15);
        this.drawObjQueue.BufferDrawobj(testLine, 1);

        let testMask = this.drawObjs.CreateSprite(64, 256);
        // testMask.tintColor.set([1, 1, 1, 0.025]);
        // testMask.mat3.TranslateXY(-Math.sin(now) * 200, 0);
        // testMask.mat3.Rotate(this.tick / 2);
        // this.drawObjQueue.BufferDrawobjAsMask(testMask, 0);
        // this.drawObjQueue.BufferDrawobj(testMask, 0);
        // testMask.mat3.Rotate(90);
        // this.drawObjQueue.BufferDrawobjAsMask(testMask, 0);
        // this.drawObjQueue.BufferDrawobj(testMask, 0);
        // this.drawObjQueue.MaskDrawobjsFromPriority(1, 0, true);

        let testMask2 = this.drawObjs.CreateSprite(512, 512);
        // testMask2.SetTextureAtlas(this.textureManager.textureAtlas);
        // testMask2.SetTexture('mariofire');
        // testMask2.tintColor.set([1, 1, 1, 0.025]);
        // testMask2.mat3.ScaleXY(Math.abs(Math.sin(now)), 1);
        // this.drawObjQueue.BufferDrawobjAsMask(testMask2, 1);
        // this.drawObjQueue.BufferDrawobj(testMask2, 0);  
        // this.drawObjQueue.MaskDrawobjsFromPriority(1, 1, false);

        // Stress tester
        for (let i = 0; i < 10000; i++) {
            // testPoly.mat3.TranslateXY((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
            // this.drawObjQueue.BufferDrawobj(testPoly, i);

            // fireMario.mat3.Rotate(1);
            // fireMario.mat3.TranslateXY((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
            // this.drawObjQueue.BufferDrawobj(fireMario, 0);

            testSprite.tintColor[0] = Math.random();
            testSprite.tintColor[1] = Math.random();
            testSprite.tintColor[2] = Math.random();
            testSprite.mat3.Rotate(1);
            testSprite.mat3.TranslateXY((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
            this.drawObjQueue.BufferDrawobj(testSprite, 0);
        }

        backgroundSprite.Release();
        testSprite.Release();
        fireMario.Release();
        testLine.Release();
        testMask.Release();
        testMask2.Release();
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
                depthClearValue: 0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
                stencilClearValue: 0,
                stencilLoadOp: 'clear',
                stencilStoreOp: 'store'
            },
            timestampWrites: {
                querySet: this.perfQuerySet,
                beginningOfPassWriteIndex: 0,
                endOfPassWriteIndex: 1
            }
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        this.drawObjQueue.EncodeRenderPassCommands(passEncoder);

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