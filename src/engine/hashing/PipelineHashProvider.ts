import {AggregateHashHandler} from "./utils/AggregateHashHandler.ts";
import type {PipelineVariant} from "../wrappers/PipelineWrapper.ts";
import type {Hasher} from "./utils/Hasher.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";


export class PipelineHashProvider {
    /** Hash of the inputs every variant shares. Each variant's hash is this plus its cull mode. */
    private sharedHandler: AggregateHashHandler;
    private currentVertexHash = "";
    private currentFragmentHash = "";
    private currentBindgroupLayoutHash = "";
    private currentAttributesHash = "";
    private currentPipelineSettingsHash = "";
    /** Variant hashes from the last computeVariants() call, in draw order. */
    private cachedVariants = new Map<PipelineVariant, string>();
    /** What this primitive's shader code was last generated from (see UpdateLayer.syncShaderInputs). */
    private shaderInputsKey = "";

    private readonly changeStamp = new ChangeStamp();


    constructor() {
        this.sharedHandler = new AggregateHashHandler(() =>
            [
                this.currentVertexHash,
                this.currentFragmentHash,
                this.currentBindgroupLayoutHash,
                this.currentAttributesHash,
                this.currentPipelineSettingsHash,
            ].join("|")
        );
    }

    getChangedAt(): number {
        return this.changeStamp.get();
    }

    markChangeStamp(){
        this.changeStamp.mark()
    }

    /** The variant hashes from the last computeVariants() call, without recomputing. */
    getCachedVariants(): Map<PipelineVariant, string> {
        return this.cachedVariants;
    }

    /**
     * @returns true when any shared input differs from what the variants were last computed with. The variant set
     * itself needs no check of its own: it is a function of alphaMode and doubleSided, which the settings hash covers.
     */
    setInputs(
        vertexHash: string,
        fragmentHash: string,
        bindgroupLayoutHash: string,
        attributesHash: string,
        pipelineSettingsHash: string,
    ): boolean {
        const changed = this.currentVertexHash !== vertexHash
            || this.currentFragmentHash !== fragmentHash
            || this.currentBindgroupLayoutHash !== bindgroupLayoutHash
            || this.currentAttributesHash !== attributesHash
            || this.currentPipelineSettingsHash !== pipelineSettingsHash;

        this.currentVertexHash = vertexHash;
        this.currentFragmentHash = fragmentHash;
        this.currentBindgroupLayoutHash = bindgroupLayoutHash;
        this.currentAttributesHash = attributesHash;
        this.currentPipelineSettingsHash = pipelineSettingsHash;
        return changed;
    }

    getShaderInputsKey(): string {
        return this.shaderInputsKey;
    }

    setShaderInputsKey(key: string): void {
        this.shaderInputsKey = key;
    }

    /** One hash per variant, in the order given (callers pass draw order). Replaces the cached map. */
    computeVariants(hasher: Hasher, variants: readonly PipelineVariant[]): Map<PipelineVariant, string> {
        const shared = this.sharedHandler.convertToHash(hasher);
        const next = new Map<PipelineVariant, string>();
        for (const variant of variants) {
            next.set(variant, hasher.hashString(`${shared}|${variant}`));
        }
        this.cachedVariants = next;
        return next;
    }
}
