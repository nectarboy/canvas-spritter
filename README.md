# Canvas Spritter

A toy 2D rendering library for JS, made with WebGPU.

Made primarily for 2D games utilizing sprites and polygons.
While it does not aim to be as feature complete as Canvas2D, it aims to serve as a faster alternative for projects that do not need to utilize everything that Canvas2D offers and mainly need drawing textured sprites.

Note: I am learning WebGPU alongside making this project, so any feedback on anything it could be doing better is fully welcome.

![Polygons and Sprites](https://github.com/nectarboy/canvas-spritter/blob/main/docs/screenshot1.webp?raw=true)
![Fake Perspective Sprite](https://github.com/nectarboy/canvas-spritter/blob/main/docs/screenshot2.webp?raw=true)

Roadmap:
- [x] get something on screen
- [x] be able to provide a list of objects to render each frame from JS land
- [x] do the above every frame
- [x] get a texture working
- [x] different textures through texture atlas
- [x] polygons
- [x] fake perspective 2d sprite
- [ ] different porter duff composite modes (for masking effects)
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

What would be pretty cool to add later:
* dynamically add and remove textures from the texture atlas
* ability for sprite to distort whats behind it (glass warping effects) [possibly using previous frame]
* checking if a sprite is visible on screen / obstructed