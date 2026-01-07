@group(1) @binding(0) var<storage, read> drawObjs : array<DrawObj>;

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) texUv: vec3f,
    @location(1) tex2Uv: vec3f,
    @location(2) @interpolate(flat) flags : u32,
    @location(3) @interpolate(flat) tex2Alpha : f32,
    @location(4) @interpolate(flat) tintColor: vec4f,
    @location(5) @interpolate(flat) texUv0 : vec2f,
    @location(6) @interpolate(flat) texUv1 : vec2f,
    @location(7) @interpolate(flat) tex2Uv0 : vec2f,
    @location(8) @interpolate(flat) tex2Uv1 : vec2f,
    @location(9) @interpolate(flat) thresholdLowerColor : vec4f,
    @location(10) @interpolate(flat) thresholdUpperColor : vec4f,
}   

@vertex
fn main(
    @builtin(vertex_index) VertexIndex : u32,
    @location(0) position : vec2f,
    @location(1) uv : vec3f,
    @location(2) drawObjIndex : u32
) -> VertexOutput {

    const MAX_PRIORITY = 1000000f;

    const screenW = 480f;
    const screenH = 360f;

    var drawObj : DrawObj = drawObjs[drawObjIndex];
    var out : VertexOutput;

    var transformedPosition : vec3f = drawObj.mat3 * vec3f(position, 1);
    transformedPosition.x /= screenW;
    transformedPosition.y /= screenH;
    out.position = vec4f(transformedPosition.x, transformedPosition.y, (drawObj.priority + 1) / MAX_PRIORITY, 1.0);
    // if (VertexIndex == 0 || VertexIndex == 2 || VertexIndex == 4) { out.position.w = 3; }

    out.texUv = drawObj.texMat3 * uv;
    out.tex2Uv = drawObj.tex2Mat3 * uv;

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