const vs = `
@vertex
fn main(
    @builtin(vertex_index) VertexIndex : u32,
    @location(0) position : vec2f
) -> @builtin(position) vec4f {
    return vec4f(position, 0.0, 1.0);
}
`;
const fs = `
@fragment
fn main() -> @location(0) vec4f {
  return vec4(1.0, 0.0, 0.0, 1.0);
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

        this.vertexBufferEntrySize = 4 * 2;
        this.vertexBufferEntries = 1024;
        this.vertexStagingCount = 0;
        this.vertexStaging = new Float32Array(this.vertexBufferEntries);
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
                        arrayStride: this.vertexBufferEntrySize,
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
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
            x - halfw, y + halfh,
            x + halfw, y + halfh,
            x - halfw, y - halfh,

            x + halfw, y + halfh,
            x + halfw, y - halfh,
            x - halfw, y - halfh
        ], this.vertexStagingCount * this.vertexBufferEntrySize);
        this.vertexStagingCount += 6;
    }
    flushVertexStaging() {
        this.vertexStagingCount = 0;
        this.vertexStaging.fill(0);
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
            this.vertexStaging.byteLength
        );

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.draw(this.vertexStaging.byteLength / this.vertexBufferEntrySize);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);

        this.flushVertexStaging();
    }
}