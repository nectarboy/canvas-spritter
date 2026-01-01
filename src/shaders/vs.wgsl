@group(1) @binding(0) var<storage, read> drawObjs : array<DrawObj>;

struct DrawObj {
    mat3 : mat3x3<f32>,
    uvMat3 : mat3x3<f32>,
    atlasPos : vec2f,
    atlasSize : vec2f,
    atlasDimension : f32,
    iAtlasDimension : f32,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) fragUv : vec3f,
    @location(1) fragColor : vec4f,
    @location(2) @interpolate(flat) atlasUv0 : vec2f,
    @location(3) @interpolate(flat) atlasUv1 : vec2f
}   

@vertex
fn main(
    @builtin(vertex_index) VertexIndex : u32,
    @location(0) position : vec2f,
    @location(1) uv : vec3f,
    @location(2) drawObjIndex : u32
) -> VertexOutput {

    const screenW = 480f;
    const screenH = 360f;

    var drawObj : DrawObj = drawObjs[drawObjIndex];

    var out : VertexOutput;

    var transformedPosition : vec3f = drawObj.mat3 * vec3f(position, 1);
    transformedPosition.x /= screenW;
    transformedPosition.y /= screenH;
    out.position = vec4f(transformedPosition.x, transformedPosition.y, 0.0, 1.0);
    // if (VertexIndex == 0 || VertexIndex == 2 || VertexIndex == 4) { out.position.w = 3; }

    var transformedUv : vec3f = drawObj.uvMat3 * uv;
    out.fragUv = transformedUv;

    if ((VertexIndex & 1) == 1) {
        out.fragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
    else {
        out.fragColor = vec4(1.0, 0.0, 1.0, 1.0);
    }

    out.atlasUv0 = drawObj.atlasPos / drawObj.atlasDimension;
    out.atlasUv1 = (drawObj.atlasPos + drawObj.atlasSize) / drawObj.atlasDimension;

    return out;

}