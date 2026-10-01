import {v4 as uuidv4} from "uuid";
import type {Hasher} from "../hashing/Hasher.ts";
import {AggregateHashHandler} from "../hashing/AggregateHashHandler.ts";
import {ShaderModuleWrapper} from "./ShaderModuleWrapper.ts";
import {ChangeStamp} from "../hashing/ChangeStamp.ts";

export type FacePass= "single" | "back" | "front"

export class PipelineWrapper {
    readonly uuid: string;

    private vertexShaderWrapper: ShaderModuleWrapper;
    private fragmentShaderWrapper: ShaderModuleWrapper;

    private currentVertexHash = "";
    private currentFragmentHash = "";
    private currentBindgroupLayoutHash = "";
    private currentAttributesHash = "";
    private currentPipelineSettingsHash = "";
    private currentFacePass: "single" | "back" | "front" = "single";

    private hashHandler: AggregateHashHandler;
    private readonly changeStamp = new ChangeStamp();

    constructor() {
        this.uuid = uuidv4();
        this.vertexShaderWrapper = new ShaderModuleWrapper();
        this.fragmentShaderWrapper = new ShaderModuleWrapper();

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

    setInputs(
        vertexHash: string,
        fragmentHash: string,
        bindgroupLayoutHash: string,
        attributesHash: string,
        pipelineSettingsHash: string,
        facePass:FacePass
    ): void {
        this.currentVertexHash = vertexHash;
        this.currentFragmentHash = fragmentHash;
        this.currentBindgroupLayoutHash = bindgroupLayoutHash;
        this.currentAttributesHash = attributesHash;
        this.currentPipelineSettingsHash = pipelineSettingsHash;
        this.currentFacePass = facePass;
    }

    markVertexShaderDirty(){
        this.vertexShaderWrapper.codeGenVersionFlag.addVersion()
        this.changeStamp.mark();
    }

    markFragmentShaderDirty(){
        this.fragmentShaderWrapper.codeGenVersionFlag.addVersion()
        this.changeStamp.mark();
    }

    getChangedAt(): number {
        return this.changeStamp.get();
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }

    getVertexShaderWrapper(): ShaderModuleWrapper  {
        return this.vertexShaderWrapper;
    }

    getFragmentShaderWrapper(): ShaderModuleWrapper {
        return this.fragmentShaderWrapper;
    }

    getFacePass(): "single" | "back" | "front" {
        return this.currentFacePass;
    }
}