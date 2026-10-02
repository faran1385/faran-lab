import {AggregateHashHandler} from "./utils/AggregateHashHandler.ts";
import type {FacePass} from "../wrappers/PipelineWrapper.ts";
import type {Hasher} from "./utils/Hasher.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";


export class PipelineHashProvider {
    private hashHandler: AggregateHashHandler;
    private currentVertexHash = "";
    private currentFragmentHash = "";
    private currentBindgroupLayoutHash = "";
    private currentAttributesHash = "";
    private currentPipelineSettingsHash = "";
    private currentFacePass: "single" | "back" | "front" = "single";
    private cachedHash = "";
    /** What this primitive's shader code was last generated from (see UpdateLayer.syncShaderInputs). */
    private shaderInputsKey = "";

    private readonly changeStamp = new ChangeStamp();


    constructor() {

        // *memoryLeak*
        this.hashHandler = new AggregateHashHandler(() =>
            [
                this.currentVertexHash,
                this.currentFragmentHash,
                this.currentBindgroupLayoutHash,
                this.currentAttributesHash,
                this.currentPipelineSettingsHash,
                this.currentFacePass,
            ].join("|")
        );
    }

    getChangedAt(): number {
        return this.changeStamp.get();
    }

    markChangeStamp(){
        this.changeStamp.mark()
    }

    /** The hash from the last convertToHash() call, without recomputing. */
    getCachedHash(): string {
        return this.cachedHash;
    }


    getFacePass(): "single" | "back" | "front" {
        return this.currentFacePass;
    }

    setInputs(
        vertexHash: string,
        fragmentHash: string,
        bindgroupLayoutHash: string,
        attributesHash: string,
        pipelineSettingsHash: string,
        facePass:FacePass
    ): boolean {
        const changed = this.currentVertexHash !== vertexHash
            || this.currentFragmentHash !== fragmentHash
            || this.currentBindgroupLayoutHash !== bindgroupLayoutHash
            || this.currentAttributesHash !== attributesHash
            || this.currentPipelineSettingsHash !== pipelineSettingsHash
            || this.currentFacePass !== facePass;

        this.currentVertexHash = vertexHash;
        this.currentFragmentHash = fragmentHash;
        this.currentBindgroupLayoutHash = bindgroupLayoutHash;
        this.currentAttributesHash = attributesHash;
        this.currentPipelineSettingsHash = pipelineSettingsHash;
        this.currentFacePass = facePass;
        return changed;
    }

    getShaderInputsKey(): string {
        return this.shaderInputsKey;
    }

    setShaderInputsKey(key: string): void {
        this.shaderInputsKey = key;
    }

    convertToHash(hasher: Hasher): string {
        this.cachedHash = this.hashHandler.convertToHash(hasher);
        return this.cachedHash;
    }
}