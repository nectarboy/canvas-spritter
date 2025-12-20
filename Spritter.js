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
    out.fragColor = vec4f(0.0, 1.0, 0.0, 1.0);
    return out;
}

`;
const fs = `
@fragment
fn main(
    @location(0) fragUv: vec2f,
    @location(1) fragColor: vec4f
) -> @location(0) vec4f {
  return fragColor;
}
`;

class Spritter {
    constructor(canvas, device) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('webgpu');
        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.ctx.configure({
            device: device,
            format: this.canvasFormat
        });

        this.device = device;
        this.encoder = device.createCommandEncoder();

        this.vertexBufferEntries = 1024;
        this.vertexStagingCount = 0;
        this.vertexStaging = new Float32Array(this.vertexBufferEntries);
        this.vertexBufferEntrySize = 4;
        this.vertexBufferEntryBytes = this.vertexBufferEntrySize * this.vertexStaging.BYTES_PER_ELEMENT;
        this.vertexBuffer = device.createBuffer({
            size: this.vertexStaging.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.pipeline = device.createRenderPipeline({
            label: 'spritter pipeline',
            layout: 'auto',
            vertex: {
                module: device.createShaderModule({
                    label: 'vs',
                    code: vs
                }),
                buffers: [
                    // vertex buffer
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
                        format: this.canvasFormat
                    }
                ]
            },
            primitive: {
                topology: 'triangle-list'
            }
        });
    };

    init() {

    }

    bufferQuad(x,y, w,h) {
        let halfw = w/2;
        let halfh = h/2;
        this.vertexStaging.set([
            x - halfw, y + halfh, 0, 0,
            x + halfw, y + halfh, 0, 0,
            x - halfw, y - halfh, 0, 0,

            x + halfw, y + halfh, 0, 0,
            x + halfw, y - halfh, 0, 0,
            x - halfw, y - halfh, 0, 0
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

        this.bufferQuad(-0.5, 0, 0.2, 0.2);


        if (Math.random() > 0.5)
            this.bufferQuad(Math.sin(now), Math.cos(now), 0.2, 0.2);
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

        // const testVertexBuffer = new Float32Array([
        //     0.0 + Math.random(), 0.5,
        //     -0.5, -0.5,
        //     0.5, -0.5,

        //     Math.random(), Math.random(),
        //     Math.random(), Math.random(),
        //     Math.random(), Math.random()
        // ]);
        this.device.queue.writeBuffer(
            this.vertexBuffer,
            0,
            this.vertexStaging.buffer,
            this.vertexStaging.byteOffset,
            this.vertexStagingCount * this.vertexBufferEntryBytes
        );

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.draw(this.vertexStagingCount);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);

        this.flushVertexStaging();
    }
}