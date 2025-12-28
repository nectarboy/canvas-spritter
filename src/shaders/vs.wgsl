

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) fragUv : vec2f,
    @location(1) fragColor : vec4f,
    @location(2) @interpolate(flat) atlasUv0 : vec2f,
    @location(3) @interpolate(flat) atlasUv1 : vec2f
}   

@vertex
fn main(
    @builtin(vertex_index) VertexIndex : u32,
    @location(0) position : vec2f,
    @location(1) uv : vec2f,
    @location(2) atlasUv0 : vec2f,
    @location(3) atlasUv1 : vec2f
) -> VertexOutput {

    var out : VertexOutput;
    out.position = vec4f(position, 0.0, 1.0);
    // if (VertexIndex == 6 || VertexIndex == 8 || VertexIndex == 10) {
    //     out.position.w = 2;
    // }
    out.atlasUv0 = atlasUv0;
    out.atlasUv1 = atlasUv1;
    out.fragUv = uv;
    // out.fragUv.x = atlasUv0.x + uv.x * (atlasUv1.x - atlasUv0.x);
    // out.fragUv.y = atlasUv0.y + uv.y * (atlasUv1.y - atlasUv0.y);
    if ((VertexIndex & 1) == 1) {
        out.fragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
    else {
        out.fragColor = vec4(1.0, 0.0, 1.0, 1.0);
    }
    return out;

}