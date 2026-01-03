@group(1) @binding(0) var<storage, read> drawObjs : array<DrawObj>;

@group(0) @binding(0) var texAtlas : texture_2d<f32>;
@group(0) @binding(1) var sam : sampler;

@fragment
fn main(
    @location(0) rawUv : vec2f,
    @location(1) texUv: vec3f,
    @location(2) tex2Uv: vec3f,
    @location(3) fragColor: vec4f,
    @location(4) @interpolate(flat) texUv0 : vec2f,
    @location(5) @interpolate(flat) texUv1 : vec2f,
    @location(6) @interpolate(flat) tex2Uv0 : vec2f,
    @location(7) @interpolate(flat) tex2Uv1 : vec2f,
    @location(8) @interpolate(flat) drawObjIndex : u32
) -> @location(0) vec4f {

    var drawObj = drawObjs[drawObjIndex];

    var uv = texUv.xy / texUv.z + vec2f(0.5, 0.5);
    uv = mix(texUv0, texUv1, fract(uv));
    var pix = textureSample(texAtlas, sam, uv);

    var uv2 = tex2Uv.xy / tex2Uv.z + vec2f(0.5, 0.5);
    uv2 = mix(tex2Uv0, tex2Uv1, fract(uv2));
    var pix2 = textureSample(texAtlas, sam, uv2);

    if ((drawObj.flags & UseSecondaryTexture) != 0) {
        //if ((drawObj.flags & MaskTextureMode) != 0) {
            pix.a *= pix2.a;
        //}
    }

    return pix;

}