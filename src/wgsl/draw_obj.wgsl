// Could some of this information be placed in a uniform buffer instead?
// Eg. texPos and texSize could be accessed through a texture index
// Or potentially even mat3's could be accessed through an index (most sprites will use identity texMat3, no?)
struct DrawObj {
    mat3 : mat3x3<f32>,
    texMat3 : mat3x3<f32>,
    tex2Mat3 : mat3x3<f32>,
    texPos : vec2f,
    texSize : vec2f,
    tex2Pos : vec2f,
    tex2Size : vec2f,
    atlasDimension : f32,
    iAtlasDimension : f32,
    flags : u32
}