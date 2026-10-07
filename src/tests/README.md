# Renderer stress tests

Browser-run tests for the add / delete / switch paths of the renderer (managers, ref counts, hashing, pipeline variants).
They need a WebGPU browser; nothing in `src/engine` is modified.

```
npm run test:render        # = vite --open /tests.html
```

Query parameters on `/tests.html`:

| param | meaning |
|---|---|
| `?only=a,b` | run scenarios whose name contains `a` or `b` (e.g. `?only=hierarchy,fuzz-seed-3`) |
| `?seeds=1,2,3&steps=120` | fuzz seeds and steps per seed (default `1..5`, 120) |
| `?fuzz=0` | skip the fuzzers |
| `?strictTextures=1` | stop working around the blank-texture bug (see below); use after fixing it |

A failing fuzz run prints its seed and the last 14 operations. Re-run it with `?only=fuzz-seed-N`.

## How it checks things

The scene is a 4x4 grid of cells, each with four quadrants. A node sits on a cell and each of its primitives draws one
small shape in its own quadrant, so nothing overlaps and the expected colour of every probe pixel follows from a plain
data model (`sim.ts`): `texture * factor` if the shape is visible, background otherwise. A clockwise shape is
back-facing, so it only shows with a double-sided material; that makes the oracle sensitive to the cull-mode pipeline
variants. Every mutation goes through `Sim`, so the model and the engine wrappers cannot drift apart.

Checks after each step:

- **GPU errors**: validation / out-of-memory / internal errors from error scopes around every frame
- **pixels**: frame is rendered into an offscreen target, read back, and compared with the model
- **orphans**: no tracker with 0 refs outside the renderer's own static resources (never collected otherwise)
- **leaks**: after removing everything, every manager is back to the empty-scene baseline
- **idle frames** create no GPU objects
- **incremental == from scratch**: the final state is also built from nothing on a second renderer; the number of live
  resources per manager and the refcount distribution must match

`warn` findings are efficiency / design expectations (dedupe counts, resources lingering a frame); `fail` is a broken
invariant.

## Scenarios

`empty-scene`, `single-node-add-remove`, `shared-wrappers-dedupe`, `identical-distinct-wrappers`, `swap-material`,
`swap-geometry`, `alpha-and-sidedness` (every alphaMode x doubleSided x winding; double-sided blend must keep two
pipelines), `texture-lifecycle`, `texture-evict-recreate`, `image-resize`, `churn-add-remove`, `reattach-timing`,
`hierarchy`, `primitive-churn`, `uv-attribute-toggle`, then `fuzz-seed-N` (one random operation per frame) and
`fuzz-batched-seed-N` (six simultaneous operations per frame).

## Known findings (engine branch at 675fcda)

1. **`texture-evict-recreate` fails.** `TextureManager.build` creates an empty texture and pixels are only written while
   `image.hashProvider.needsUpdate()` is true. That flag is synced after the first upload, so a texture destroyed when its
   last user left and re-created later stays blank. (The comment in `RenderItemBuilder` "a freshly created resource
   already has current data" holds for buffers, not textures.) All other scenarios and the fuzzers re-upload textures
   themselves to look past this; `?strictTextures=1` turns that off.
2. **`image-resize` fails.** `ImageHashProvider` builds its key with `${getDimentions()}`, which stringifies the
   `{width, height}` object (`[object Object]`), so `setDimensions()` never changes the hash. The old 2x2 texture then
   receives a 4x4 `writeTexture` -> validation error.
3. **Uniform padding portability** (not a failure here). `planMaterialFactors` pads with `_paddingN: array<f32, K>` inside
   a uniform struct. That compiles only where the WGSL feature `uniform_buffer_standard_layout` exists; elsewhere every
   material shader is invalid. If your browser lacks it, the rig rewrites those fields into `K` plain `f32` members
   (same layout) and says so via `rig.shimmed`; the engine is untouched.

## Files

`rig.ts` renderer + instrumentation, `sim.ts` model / oracle / scene builder, `checks.ts` shared assertions,
`scenarios.ts` curated scenarios, `fuzz.ts` random operations, `run.ts` + `../../tests.html` the page.
