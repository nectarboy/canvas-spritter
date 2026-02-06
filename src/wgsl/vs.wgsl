@group(1) @binding(0) var<storage, read> drawObjs : array<DrawObj>;
@group(1) @binding(1) var<storage, read> vertices : array<VertexInput>;

struct VertexInput {
    uv : vec2f,
    uvDepth : vec2f,
    position : vec2f,
    padding: vec2f
};

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) texUv: vec2f,
    @location(1) texUvDepth : vec2f,
    @location(2) tex2Uv: vec2f,
    @location(3) tex2UvDepth: vec2f,
    @location(4) displacementScale : vec2f,
    @location(5) @interpolate(flat) flags : u32,
    @location(6) @interpolate(flat) tex2Alpha : f32,
    @location(7) @interpolate(flat) tintColor: vec4f,
    @location(8) @interpolate(flat) texUv0 : vec2f,
    @location(9) @interpolate(flat) texUv1 : vec2f,
    @location(10) @interpolate(flat) tex2Uv0 : vec2f,
    @location(12) @interpolate(flat) tex2Uv1 : vec2f,
    @location(13) @interpolate(flat) thresholdLowerColor : vec4f,
    @location(14) @interpolate(flat) thresholdUpperColor : vec4f,
}   

@vertex
fn main(
    @builtin(vertex_index) pullerIndex : u32,
    // @location(0) packedIndices : u32
    @location(0) vertexIndex : u32,
    @location(1) drawObjIndex : u32
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

    // let vertexIndex : u32 = packedIndices & 0x1ffff;
    // let drawObjIndex : u32 = packedIndices >> 17;

    var vertex : VertexInput = vertices[vertexIndex];
    var drawObj : DrawObj = drawObjs[drawObjIndex];
    var out : VertexOutput;

    var transformedPosition : vec3f = drawObj.mat3 * vec3f(vertex.position, 1);
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

    // Primary texture UV
    if ((drawObj.flags & PatternMode) != 0) {
        var texUv = vec3f(vertex.position.x, -vertex.position.y, 1);
        if ((drawObj.flags & SeeThroughMode) != 0) {
            texUv = seeThrough * texUv;
        }
        texUv = drawObj.texMat3 * texUv;
        out.texUv = texUv.xy / (2 * drawObj.texSize) * vertex.uvDepth;
    }
    else {
        out.texUv = (drawObj.texMat3 * vec3f(vertex.uv, 1)).xy * vertex.uvDepth;
    }
    out.texUv.x = select(out.texUv.x, -out.texUv.x, (drawObj.flags & FlipTextureX) != 0);
    out.texUv.y = select(out.texUv.y, -out.texUv.y, (drawObj.flags & FlipTextureY) != 0);
    out.texUvDepth = vertex.uvDepth; 

    // Secondary texture UV
    if ((drawObj.flags & SecondaryPatternMode) != 0) {
        var tex2Uv = vec3f(vertex.position.x, -vertex.position.y, 1);
        if ((drawObj.flags & SecondarySeeThroughMode) != 0) {
            tex2Uv = seeThrough * tex2Uv;
        }
        tex2Uv = drawObj.tex2Mat3 * tex2Uv;
        out.tex2Uv = tex2Uv.xy / (2 * drawObj.tex2Size) * vertex.uvDepth;
    }
    else {
        out.tex2Uv = (drawObj.tex2Mat3 * vec3f(vertex.uv, 1)).xy * vertex.uvDepth;
    }
    out.tex2Uv.x = select(out.tex2Uv.x, -out.tex2Uv.x, (drawObj.flags & FlipSecondaryTextureX) != 0);
    out.tex2Uv.y = select(out.tex2Uv.y, -out.tex2Uv.y, (drawObj.flags & FlipSecondaryTextureY) != 0);
    out.tex2UvDepth = vertex.uvDepth;

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