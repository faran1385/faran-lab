import type {RenderContext} from "../Renderer/RenderContext.ts";
import type {SkinInstanceWrapper} from "../wrappers/SkinInstanceWrapper.ts";
import type {WGSLType} from "../producers/utils.ts";

export interface SkinningPaletteField {
    name: string;
    type: WGSLType;
    offset: number;
}

export interface SkinningShaderParts {
    /** Extra WGSL struct declarations (excluding the palette element struct, which is emitted from the binding descriptor). */
    structs: string;
    /** WGSL helper and skinning function definitions. */
    functions: string;
    /** Function name called by VertexSkinnedAssembler. */
    skinFn: string;
    paletteElementStructName: string;
    paletteElementFields: SkinningPaletteField[];
}

/** Context intentionally exposes only what a method needs to update its own palette. */
export type SkinningContext = Pick<RenderContext, "managers" | "worldMoved">;

/**
 * A pluggable skinning algorithm. One method instance belongs to one SkinInstanceWrapper.
 * The id must change whenever the palette representation or generated WGSL changes.
 */
export interface SkinningMethod {
    readonly id: string;
    readonly paletteStrideBytes: number;
    shaderParts(): SkinningShaderParts;
    initialPalette(jointCount: number): ArrayBuffer;
    attach(skin: SkinInstanceWrapper): void;
    /** Force the next update to rewrite the entire palette after its GPU allocation is recreated. */
    invalidatePalette(): void;
    update(ctx: SkinningContext): void;
}
