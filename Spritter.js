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

        this.bufferStride = 4 * 2;
        this.someBuffer = device.createBuffer({
            size: 4096,
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
                        arrayStride: this.bufferStride,
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

    draw() {
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

        const testVertexBuffer = new Float32Array([
            0.0 + Math.random(), 0.5,
            -0.5, -0.5,
            0.5, -0.5,

            Math.random(), Math.random(),
            Math.random(), Math.random(),
            Math.random(), Math.random()
        ]);
        this.device.queue.writeBuffer(
            this.someBuffer,
            0,
            testVertexBuffer.buffer,
            testVertexBuffer.byteOffset,
            testVertexBuffer.byteLength
        );

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setVertexBuffer(0, this.someBuffer);
        passEncoder.draw(testVertexBuffer.length);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}