import type {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import type {Struct} from "../producers/AssemblerProducers.ts";

/** A skin's joints in palette order: the Map's insertion order is the palette index (the glTF `joints[]` order). */
export type SkinJoints = ReadonlyMap<NodeWrapper, Float32Array>;

/**
 * One way of deforming a skinned mesh (LBS, DQS, ...). A method owns everything that has to agree with it: the palette
 * layout, the WGSL that reads the palette, and the CPU code that writes it. The engine only knows this interface, so
 * a new method is a new class and nothing else changes.
 *
 * Methods hold no per-skin state besides scratch memory, so one instance may be shared by several skins.
 *
 * WGSL contract. Before `code`, the engine declares:
 *   - `struct SkinnedVertex { position: vec3f, normal: vec3f }`
 *   - the element struct `paletteElement` and the palette `var<storage, read> palette: array<Element>` (group 1)
 * `code` must define
 *   fn skin(pos: vec3f, nrm: vec3f, joints: vec4u, weights: vec4f) -> SkinnedVertex
 * and may define helpers next to it. The result is in WORLD space (glTF: the skinned node's own transform is ignored),
 * so the vertex shader does not apply the node's world matrix on top of it.
 */
export interface SkinningMethod {
    /**
     * Identity of the shader code and palette layout. Vertex shader variants are cached under it, so two methods that
     * differ in `code` or `paletteElement` must not share an id.
     */
    readonly id: string;
    /** Bytes per joint in the palette buffer. */
    readonly paletteStrideBytes: number;
    /** The WGSL element type of the palette array. */
    readonly paletteElement: Struct;
    /** WGSL: the `skin` function (see the contract above). */
    readonly code: string;

    /** Palette contents before the first `update`: `jointCount * paletteStrideBytes` bytes. */
    initialPalette(jointCount: number): ArrayBuffer;

    /**
     * Rewrites the whole palette in place from the joints' current world matrices. The skin adaptor has already
     * brought the joints' world matrices up to date and queues the upload afterwards.
     */
    update(palette: ArrayBuffer, joints: SkinJoints): void;
}
