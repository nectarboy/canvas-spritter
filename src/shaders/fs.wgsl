@group(0) @binding(0) var texAtlas : texture_2d<f32>;
@group(0) @binding(1) var sam : sampler;

@fragment
fn main(
    @location(0) fragUv: vec2f,
    @location(1) fragColor: vec4f,
    @location(2) @interpolate(flat) atlasUv0 : vec2f,
    @location(3) @interpolate(flat) atlasUv1 : vec2f
) -> @location(0) vec4f {

    var uv = fract(fragUv);
    uv.x = atlasUv0.x + fract(uv.x) * (atlasUv1.x - atlasUv0.x);
    uv.y = atlasUv0.y + fract(uv.y) * (atlasUv1.y - atlasUv0.y);
    var pix = textureSample(texAtlas, sam, uv);
    return pix;

}