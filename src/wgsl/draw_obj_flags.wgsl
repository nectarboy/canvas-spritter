alias DrawObjFlag = u32;
const UseTexture : DrawObjFlag = 0x1;
const UseSecondaryTexture : DrawObjFlag = 0x2;
const RepeatTexture : DrawObjFlag = 0x4;
const RepeatSecondaryTexture : DrawObjFlag = 0x8;
const MaskTextureMode : DrawObjFlag = 0x10;    
const DisplacementTextureMode : DrawObjFlag = 0x20; 
const PatternMode : DrawObjFlag = 0x40;