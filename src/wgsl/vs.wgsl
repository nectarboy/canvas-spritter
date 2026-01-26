@group(1) @binding(0) var<storage, read> drawObjs : array<DrawObj>;

struct VertexOutput {
    @builtin(position) position : vec4f,
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
}   

@vertex
fn main(
    @builtin(vertex_index) VertexIndex : u32,
    @location(0) position : vec2f,
    @location(1) uv : vec3f,
    @location(2) drawObjIndex : u32
) -> VertexOutput {

    // TODO: calculate stuff that will be uniform across all a DrawObj's vertices in a seperate pass beforehand, to pass along here?

    const IDENTITY : mat3x3<f32> = mat3x3<f32>(
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    );

    const MAX_ORDERING = 1000000f;

    const screenW = 480f;
    const screenH = 360f;

    var drawObj : DrawObj = drawObjs[drawObjIndex];
    var out : VertexOutput;

    var transformedPosition : vec3f = drawObj.mat3 * vec3f(position, 1);
    transformedPosition.x /= screenW;
    transformedPosition.y /= screenH;
    out.position = vec4f(transformedPosition.x, transformedPosition.y, (drawObj.ordering + 1) / MAX_ORDERING, 1.0);
    // if (VertexIndex == 0 || VertexIndex == 2 || VertexIndex == 4) { out.position.w = 3; }

    out.displacementScale = sqrt(vec2f(
        drawObj.texMat3[0][0]*drawObj.texMat3[0][0] + drawObj.texMat3[0][1]*drawObj.texMat3[0][1],
        drawObj.texMat3[1][0]*drawObj.texMat3[1][0] + drawObj.texMat3[1][1]*drawObj.texMat3[1][1]
    ))
    * vec2f(
        select(1.0, -1.0, (drawObj.flags & FlipTextureX) != 0),
        select(1.0, -1.0, (drawObj.flags & FlipTextureY) != 0)
    )
    * drawObj.displacementStrength;

    // matrix that produces a see-through effect for patterns
    var seeThrough = drawObj.mat3;
    seeThrough[0][1] = -seeThrough[0][1];
    seeThrough[1][0] = -seeThrough[1][0];
    seeThrough[2][1] = -seeThrough[2][1];

    if ((drawObj.flags & PatternMode) != 0) {
        // out.displacementScale = vec2f(1);
        // out.displacementScale /= drawObj.texSize;
        out.texUv = vec3f(position.x, -position.y, uv.z);
        if ((drawObj.flags & SeeThroughMode) != 0) {
            out.texUv = seeThrough * out.texUv;
        }
        out.texUv = drawObj.texMat3 * out.texUv;
        out.texUv.x /= 2 * drawObj.texSize.x;
        out.texUv.y /= 2 * drawObj.texSize.y;
    }
    else {
        out.texUv = drawObj.texMat3 * uv;
    }
    out.texUv.x = select(out.texUv.x, -out.texUv.x, (drawObj.flags & FlipTextureX) != 0);
    out.texUv.y = select(out.texUv.y, -out.texUv.y, (drawObj.flags & FlipTextureY) != 0);

    if ((drawObj.flags & SecondaryPatternMode) != 0) {
        //out.tex2Uv = drawObj.tex2Mat3 * effectArray[select(0, 1, (drawObj.flags & SecondarySeeThroughMode) != 0)] * vec3f(position.x, -position.y, uv.z);
        out.tex2Uv = vec3f(position.x, -position.y, uv.z);
        if ((drawObj.flags & SecondarySeeThroughMode) != 0) {
            out.tex2Uv = seeThrough * out.tex2Uv;
        }
        out.tex2Uv = drawObj.tex2Mat3 * out.tex2Uv;
        out.tex2Uv.x /= 2 * drawObj.tex2Size.x;
        out.tex2Uv.y /= 2 * drawObj.tex2Size.y;
    }
    else {
        out.tex2Uv = drawObj.tex2Mat3 * uv;
    }
    out.tex2Uv.x = select(out.tex2Uv.x, -out.tex2Uv.x, (drawObj.flags & FlipSecondaryTextureX) != 0);
    out.tex2Uv.y = select(out.tex2Uv.y, -out.tex2Uv.y, (drawObj.flags & FlipSecondaryTextureY) != 0);

    out.tintColor = drawObj.tintColor;
    out.tex2Alpha = drawObj.tex2Alpha;
    out.flags = drawObj.flags;

    out.texUv0 = drawObj.texPos / drawObj.atlasDimension;
    out.texUv1 = (drawObj.texPos + drawObj.texSize) / drawObj.atlasDimension;
    out.tex2Uv0 = drawObj.tex2Pos / drawObj.atlasDimension;
    out.tex2Uv1 = (drawObj.tex2Pos + drawObj.tex2Size) / drawObj.atlasDimension;

    out.thresholdLowerColor = drawObj.thresholdLowerColor;
    out.thresholdUpperColor = drawObj.thresholdUpperColor;

    return out;
}