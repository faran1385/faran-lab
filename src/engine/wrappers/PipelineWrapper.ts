import {v4 as uuidv4} from "uuid";
import {ShaderModuleWrapper} from "./ShaderModuleWrapper.ts";
import {PipelineHashProvider} from "../hashing/PipelineHashProvider.ts";

/**
 * A primitive owns one GPURenderPipeline per cull mode it needs. The cull mode is the variant's identity: it is the
 * only thing that differs between the variants of one primitive (besides what the shared inputs already cover).
 *
 * Note the inversion: cullMode "front" culls front faces, so that variant DRAWS back faces.
 */
export type PipelineVariant = GPUCullMode;

/**
 * Draw order of the variants. A double-sided blended mesh has to draw its back faces (cullMode "front") before its
 * front faces (cullMode "back"), so iteration must go through this list, never through Map insertion order.
 */
export const PIPELINE_VARIANT_ORDER: readonly PipelineVariant[] = ["front", "back", "none"];

/** The variants a material needs, in draw order. A pure function of alphaMode and doubleSided. */
export function pipelineVariantsOf(alphaMode: "opaque" | "mask" | "blend", doubleSided: boolean): PipelineVariant[] {
    if (!doubleSided) return ["back"];
    if (alphaMode === "blend") return ["front", "back"];    // back faces first, then front faces over them
    return ["none"];
}

export class PipelineWrapper {
    readonly uuid: string;

    private vertexShaderWrapper: ShaderModuleWrapper;
    private fragmentShaderWrapper: ShaderModuleWrapper;
    readonly hashProvider: PipelineHashProvider


    constructor() {
        this.uuid = uuidv4();
        this.vertexShaderWrapper = new ShaderModuleWrapper();
        this.fragmentShaderWrapper = new ShaderModuleWrapper();

        this.hashProvider = new PipelineHashProvider();
    }

    markVertexShaderDirty() {
        this.vertexShaderWrapper.hashProvider.markCodeGen()
        this.hashProvider.markChangeStamp()

    }

    markFragmentShaderDirty() {
        this.fragmentShaderWrapper.hashProvider.markCodeGen()
        this.hashProvider.markChangeStamp()

    }

    getVertexShaderWrapper(): ShaderModuleWrapper {
        return this.vertexShaderWrapper;
    }

    getFragmentShaderWrapper(): ShaderModuleWrapper {
        return this.fragmentShaderWrapper;
    }

}