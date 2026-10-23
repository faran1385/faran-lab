# Renderer tests (redesign branch)

Browser-run tests, no engine file is modified. They need a WebGPU browser.

```
npm run test:render        # = vite --open /tests.html
```

| query | meaning |
|---|---|
| `?only=a,b` | run scenarios whose name contains `a` or `b` (`?only=massive`, `?only=low-level`, `?only=high-level-texture`) |
| `?scale=0.2` | multiplies every massive count (default 1). Use a small value on a weak GPU |
| `?stress=0` / `?changes=0` | skip the massive scenes / the change-trigger scenarios |

Timing is printed with `console.log` (devtools console, lines start with `[scenario-name]`) and shown on the page:
`LARGE FRAME (cold)` is the first frame of a big scene (CPU time of `Renderer.render()` + time until the GPU is done),
then 30 steady frames, then the resources alive. Times are reported, never asserted.

## Massive scenes (`stress.ts`)
Shared mesh (20k nodes), unique materials, unique geometries, multi-primitive meshes, unique/shared textures, every
pipeline variant, deep chain (up to 10k), wide tree (~11k), 2M-triangle geometry, churn, animation (5% of 20k nodes
move per frame), and a mixed scene. Each checks: no GPU errors, no orphan trackers, resource counts are affine in the
node count (shared things once, per-node things once per node), quiet frames create/upload/hash nothing, and the scene
leaves nothing behind when removed.

## Change triggers (`changes.ts`, `internals.ts`)
One setter, then what the engine did: GPU objects created, in-place uploads, hash calls, epoch movement. After every
change the engine must be quiet again. `fail` = broken invariant, `warn` = efficiency expectation.

- `high-level-*`: NodeWrapper, Mesh/Primitive, Material/Component, Texture/Image/Sampler, Geometry/Attribute, camera and target format
- `low-level-machinery`: epoch, ChangeStamp, VersionFlag, PreFrameQueue, Source, upload queue, hash handlers
- `low-level-hash-providers`: when hashes recompute, what feeds them, which setters stamp
- `low-level-managers`: ensure / acquire / release / collect / upload
- `low-level-raw-scene`: scene built from internals with hand-written WGSL, no wrappers or adapters; frames are read back to prove each change reached the screen

## Findings at this commit (2ce0a6b)
1. `TextureWrapper.setImage` / `setSampler` on a texture that is already bound never reach the bind group (the bind group holds the image and sampler, nothing tells the material).
2. `AttributeWrapper.setData` on a wrapper that is already in a geometry never reaches the GPU (the GPU buffer is keyed by the AttributeInternal; `IndexAttributeWrapper.setData` works because the wrapper itself is the buffer).
3. (warn) a data-only `geometry.setAttribute` re-stamps pipelines and hashes 6 times.
4. (warn) toggling a material setting back recompiles the pipeline (destroyed one frame after last use).
5. (warn) swapping only the vertex assembler re-runs the fragment assembler.
6. (warn) node chains deeper than ~2.5k-5k overflow the stack (invalidateWorld / ensureWorld recurse per level).
