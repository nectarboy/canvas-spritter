# Canvas Spritter

A toy 2D rendering library for JS, made with WebGPU.

Made primarily for 2D games utilizing sprites and polygons.
While it does not aim to be as feature complete as Canvas2D, it aims to serve as a faster alternative for projects that do not need to utilize everything that Canvas2D offers, while also offering some features that Canvas2D does not.

Note: I am learning WebGPU alongside making this project, so any feedback on anything it could be doing better is fully welcome.

![Polygons and Sprites](https://github.com/nectarboy/canvas-spritter/blob/main/docs/screenshot1.webp?raw=true)
![Fake Perspective Sprite](https://github.com/nectarboy/canvas-spritter/blob/main/docs/screenshot2.webp?raw=true)

## Goals:

* Implement a variety of "Draw Objects" like textured sprites, polygons, etc.
* Implement special effects like masking and shaders
* Do everything in as little draw calls and passes as possible

## Roadmap:

- [x] get something on screen
- [x] be able to provide a list of objects to render each frame from JS land
- [x] do the above every frame
- [x] get a texture working
- [x] different textures through texture atlas
- [x] polygons
- [x] fake perspective 2d sprite
- [x] use a second texture as a mask or displacement map
- [x] optimize opaque overdraw
    - with alpha blending enabled, apparently this is a REALLY BAD gpu performance killer. even just 1000 sprites take *10ms* if they all overlap, even if they are completely opaque. adding just one simple opaque background also increases total time dramatically, due to blending technically having to occur everywhere across the clip space.
    - an opaque front-to-back pass + transparent back-to-front pass alongside a depth buffer is used. this boosts performance for overdrawn opaque sprites, but overdrawn transparent sprites must still blend (at least they are not drawn behind any opaque sprites)
- [ ] implement all of the remaining DrawObj flags
- [ ] switch to different porter duff composite modes in seperate passes for more complex scene-wise masking effects
- [ ] basic built-in shaders like outlines
- [ ] sprite tinting
- [ ] circles / arcs
- [ ] cleanup interface, make it good and easy to use
- [ ] optimize / reduce data throughput
    - optimize vertex generation by cpu (its the main bottleneck, hurts when sprite count > 1000)
    - drawobjs using same vertex data? (maybe would be good for polygons with the same shape)
    - reduce data used / transported between shaders?
    - use a better bin packing algorithm as well as tesselation algorithm
- [ ] different draw calls for bigger amounts of data (multiple texture atlases) or smth

## What would be pretty cool to add later:

* dynamically add and remove textures from the texture atlas
* ability for sprite to distort whats behind it (glass warping effects) [possibly using previous frame]
* checking if a sprite is visible on screen / obstructed