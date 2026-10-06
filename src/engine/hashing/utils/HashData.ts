/**
 * Every hash the render path needs, resolved once by the HashResolver and handed to everything downstream.
 * Producers, the resource layer and the item assembler read these strings; none of them calls a convertTo*Hash().
 */
import type {PipelineVariant} from "../../wrappers/PipelineWrapper.ts";

export interface MaterialTextureHashes {
    image: string;
    sampler: string;
}

export interface MaterialHashes {
    /** Uniform buffer holding the factors (identity-keyed: material uuid + factor count). */
    factors: string;
    /** Bind group layout / pipeline layout. Includes the binding plan signature. */
    layout: string;
    /** Bind group contents (changes when a texture or sampler is swapped). */
    bindgroup: string;
    /** What the material contributes to the generated shader code. */
    shader: string;
    /** Pipeline state derived from the material (blend, cull, depth write). */
    pipelineSettings: string;
    /** Image / sampler hashes of every textured component, keyed by component name. */
    textures: Map<string, MaterialTextureHashes>;
}

export interface GeometryHashes {
    /** Attribute names + formats only: what shaders and pipelines depend on. */
    attributesShape: string;
    /** Buffer hash of every attribute, keyed by attribute name. */
    attributeBuffers: Map<string, string>;
    indices?: string;
}

export interface PipelineHashes {
    vertexShader: string;
    fragmentShader: string;
    /** One pipeline hash per cull-mode variant, in draw order. Look up through PIPELINE_VARIANT_ORDER. */
    pipelines: Map<PipelineVariant, string>;
}

export interface HashData {
    material: MaterialHashes;
    geometry: GeometryHashes;
    pipeline: PipelineHashes;
}

/** A resolved hash set plus whether it was (re)computed by this call. GPU resources are ensured only when it was. */
export interface Resolved<T> {
    hashes: T;
    computed: boolean;
}
