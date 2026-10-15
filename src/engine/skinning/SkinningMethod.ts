import type {SkinInstanceWrapper} from "../wrappers/SkinInstanceWrapper.ts";
import type {RenderContext} from "../Renderer/RenderContext.ts";
import type {StructField} from "../producers/AssemblerProducers.ts";

/** The slice of the render context a skinning method may use while updating its palette. */
export type SkinContext = Pick<RenderContext, "managers" | "worldEpoch">;

/**
 * The WGSL a skinning method contributes to the vertex shader.
 *
 * The engine declares, before these parts:
 *   - the palette storage binding `palette: array<PaletteElement>` (element struct from `paletteElement`)
 *   - `struct SkinnedVertex { position: vec3f, normal: vec3f }`
 * `functions` may read `palette` and may use `structs`. `skinFn` names the function the assembler calls:
 *   fn <skinFn>(pos: vec3f, nrm: vec3f, joints: vec4u, weights: vec4f) -> SkinnedVertex
 * Its result is in world space: the skinned node's own world matrix must not be applied on top of it.
 */
export interface SkinningShaderParts {
    /** Extra WGSL struct declarations the functions need. May be empty. */
    structs: string;
    /** WGSL functions. Declaration order does not matter at WGSL module scope. */
    functions: string;
    /** Name of the entry function the assembler calls. */
    skinFn: string;
}

/**
 * One way of deforming a skinned mesh (LBS, DQS, ...). A method owns everything that has to agree with it: the palette
 * layout, the shader code that reads the palette, and the CPU code that writes it. The engine only knows this interface.
 *
 * One instance per skin: `SkinInstanceWrapper.setSkinning` attaches it, and it keeps its per-skin write state.
 */
export interface SkinningMethod {
    /**
     * Identity of the method including everything that changes the palette layout or the shader code. It is part of
     * the palette buffer key, the node bind group key and the shader inputs key: two methods that differ in either
     * must not share an id.
     */
    readonly id: string;
    /** Bytes per joint in the palette buffer. */
    readonly paletteStrideBytes: number;
    /** The WGSL element type of the palette array (declared by the engine in the node bind group). */
    readonly paletteElement: { structName: string; fields: StructField[] };

    shaderParts(): SkinningShaderParts;

    /** Initial palette contents, `jointCount * paletteStrideBytes` bytes. Drawn until the first `update`. */
    initialPalette(jointCount: number): ArrayBuffer;

    /** Called by `SkinInstanceWrapper.setSkinning`. A method belongs to exactly one skin. */
    attach(skin: SkinInstanceWrapper): void;
    detach(skin: SkinInstanceWrapper): void;

    /**
     * Once per frame for every skin visited by the render traversal, after the world matrices were rebuilt and before
     * submit. Writes the palette through `ctx.managers.bufferManager.upload(skin.getPaletteKey(), data)`.
     */
    update(ctx: SkinContext): void;
}

/** Handles the attach/detach bookkeeping so a concrete method only writes shader parts and `update`. */
export abstract class BaseSkinningMethod implements SkinningMethod {
    abstract readonly id: string;
    abstract readonly paletteStrideBytes: number;
    abstract readonly paletteElement: { structName: string; fields: StructField[] };

    private attachedSkin?: SkinInstanceWrapper;

    abstract shaderParts(): SkinningShaderParts;

    abstract initialPalette(jointCount: number): ArrayBuffer;

    abstract update(ctx: SkinContext): void;

    attach(skin: SkinInstanceWrapper): void {
        if (this.attachedSkin && this.attachedSkin !== skin) {
            throw new Error(`${this.constructor.name}: already attached to skin "${this.attachedSkin.name ?? this.attachedSkin.uuid}"; create one method instance per skin`);
        }
        this.attachedSkin = skin;
    }

    detach(skin: SkinInstanceWrapper): void {
        if (this.attachedSkin === skin) this.attachedSkin = undefined;
    }

    protected get skin(): SkinInstanceWrapper {
        if (!this.attachedSkin) throw new Error(`${this.constructor.name}: update() before attach()`);
        return this.attachedSkin;
    }
}
