const vs = `
@vertex
fn main(
  @builtin(vertex_index) VertexIndex : u32
) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(
    vec2(0.0, 0.5),
    vec2(-0.5, -0.5),
    vec2(0.5, -0.5)
  );

  return vec4f(pos[VertexIndex], 0.0, 1.0);
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

        this.pipeline = device.createRenderPipeline({
            label: 'spritter pipeline',
            layout: 'auto',
            vertex: {
                module: device.createShaderModule({
                    label: 'vs',
                    code: vs
                })
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

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.draw(3);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}