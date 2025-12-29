@group(1) @binding(0) var<storage, read> drawObjs : array<DrawObj>;

struct DrawObj {
    mat3 : mat3x3<f32>,
    uvMat3 : mat3x3<f32>,
    atlasPos : vec2f,
    atlasSize : vec2f,
    atlasDimension : f32,
    iAtlasDimension : f32,
}

@group(0) @binding(0) var texAtlas : texture_2d<f32>;
@group(0) @binding(1) var sam : sampler;

@fragment
fn main(
    @location(0) fragUv: vec2f,
    @location(1) fragColor: vec4f,
    @location(2) @interpolate(flat) atlasUv0 : vec2f,
    @location(3) @interpolate(flat) atlasUv1 : vec2f
) -> @location(0) vec4f {

    var uv = fragUv;
    // uv.x += sin(fragUv.y * 20) / 10;

    var uv0 = atlasUv0;
    var uv1 = atlasUv1;
    uv = mix(uv0, uv1, fract(uv));
    var pix = textureSampleLevel(texAtlas, sam, uv, 0);
    //return fragColor;
    return pix;

}