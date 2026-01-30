@group(1) @binding(0) var<storage, read> drawObjs : array<DrawObj>;

@group(0) @binding(0) var texAtlas : texture_2d<f32>;
@group(0) @binding(1) var nearestSam : sampler;
@group(0) @binding(2) var linearSam : sampler;

@fragment
fn main(
    @location(0) texUv: vec3f,
    @location(1) tex2Uv: vec3f,
    @location(2) displacementScale : vec2f,
    @location(3) @interpolate(flat) flags : u32,
    @location(4) @interpolate(flat) tex2Alpha : f32,
    @location(5) @interpolate(flat) tintColor: vec4f,
    @location(6) @interpolate(flat) texUv0 : vec2f,
    @location(7) @interpolate(flat) texUv1 : vec2f,
    @location(8) @interpolate(flat) tex2Uv0 : vec2f,
    @location(9) @interpolate(flat) tex2Uv1 : vec2f,
    @location(10) @interpolate(flat) thresholdLowerColor : vec4f,
    @location(11) @interpolate(flat) thresholdUpperColor : vec4f,
) -> @location(0) vec4f {

    var uv = texUv.xy / texUv.z;
    var pix : vec4f;

    //return vec4f(1, f32(flags) / 10000.0, 1, 1);
    //return textureSample(texAtlas, linearSam, texUv0);

    // Single texture
    if ((flags & UseSecondaryTexture) == 0) {

        // No texture
        if ((flags & UseTexture) == 0) {
            pix = tintColor;
            pix = select(pix, vec4f(0), (pix > thresholdLowerColor) & (pix <= thresholdUpperColor));
            if (pix.a <= 0) {
                discard;
            }
            return pix;
        }

        // Sample texture
        var oob : bool = (abs(uv.x) > 0.5) | (abs(uv.y) > 0.5);
        uv = mix(texUv0, texUv1, fract(uv + vec2f(0.5, 0.5)));
        if ((flags & FilterTexture) != 0) {
            pix = textureSampleLevel(texAtlas, linearSam, uv, 0);
        }
        else {
            pix = textureSampleLevel(texAtlas, nearestSam, uv, 0);
        }

        // Make pixel invisible if O.O.B. and repeat is unset
        var dontWrap = oob & ((flags & RepeatTexture) == 0);
        pix = select(pix, vec4f(0,0,0,0), dontWrap);

    }
    // Using secondary texture
    else {

        // Sample secondary texture
        var uv2 = tex2Uv.xy / tex2Uv.z;
        var oob2 : bool = (abs(uv2.x) > 0.5) | (abs(uv2.y) > 0.5);
        uv2 = mix(tex2Uv0, tex2Uv1, fract(uv2 + vec2f(0.5, 0.5)));
        var pix2 : vec4f;
        if ((flags & FilterSecondaryTexture) != 0) {
            pix2 = textureSampleLevel(texAtlas, linearSam, uv2, 0);
        }
        else {
            pix2 = textureSampleLevel(texAtlas, nearestSam, uv2, 0);
        }

        var dontWrap2 = oob2 & ((flags & RepeatSecondaryTexture) == 0);
        pix2 = select(pix2, vec4f(0,0,0,0), dontWrap2);


        // No primary texture
        if ((flags & UseTexture) == 0) {
            pix = vec4f(1);
        }
        // Sample primary texture
        else {
            // Displacement
            // if ((flags & DisplacementTextureMode) != 0) {
            //     uv.x += (pix2.a - 0.5) * select(.25, -.25, (flags & FlipTextureX) != 0) * displacementScale.x;
            //     uv.y += (pix2.a - 0.5) * select(.25, -.25, (flags & FlipTextureY) != 0) * displacementScale.y;
            // }
            // TODO: test out this branchless version
            var displacement = vec2f(pix2.a) - select(vec2f(0), vec2f(0.5), (flags & SignedDisplacementMode) != 0);
            displacement *= displacementScale;
            uv += displacement;

            // Sample texture
            var oob : bool = (abs(uv.x) > 0.5) | (abs(uv.y) > 0.5);
            uv = mix(texUv0, texUv1, fract(uv + vec2f(0.5, 0.5)));
            if ((flags & FilterTexture) != 0) {
                pix = textureSampleLevel(texAtlas, linearSam, uv, 0);
            }
            else {
                pix = textureSampleLevel(texAtlas, nearestSam, uv, 0);
            }

            var dontWrap = oob & ((flags & RepeatTexture) == 0);
            pix = select(pix, vec4f(0,0,0,0), dontWrap);
        }

        // Masking
        if ((flags & MaskTextureMode) != 0) {
            var colorMask = select(vec3f(1,1,1), pix2.rgb, (flags & MaskTextureColorChannels) != 0);
            pix.r *= colorMask.r;
            pix.g *= colorMask.g;
            pix.b *= colorMask.b;
            pix.a *= pix2.a;
        }
        // TODO: test out this branchless version
        // var mask = vec4f(
        //     select(vec3f(1), pix2.rgb, (flags & (MaskTextureColorChannels | MaskTextureMode)) == (MaskTextureColorChannels | MaskTextureMode)),
        //     select(1, pix2.a, (flags & MaskTextureMode) != 0)
        // );
        // pix *= mask;

        // Blending tex1 with tex2
        if (tex2Alpha != 0) {
            if ((flags & SecondaryTextureAddBlend) != 0) {
                pix += pix2 * tex2Alpha;
            }
            else {
                let pix2Alpha = tex2Alpha * pix2.a;
                pix2.a = 1;
                pix = pix2 * pix2Alpha + pix * (1 - pix2Alpha);
            }
        }
    }

    // Tinting
    pix *= tintColor;

    // Threshold cutting
    pix = select(pix, vec4f(0), (pix > thresholdLowerColor) & (pix <= thresholdUpperColor));

    if (pix.a <= 0) {
        discard;
    }

    return pix;
}