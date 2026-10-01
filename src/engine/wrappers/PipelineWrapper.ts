import {v4 as uuidv4} from "uuid";
import {ShaderModuleWrapper} from "./ShaderModuleWrapper.ts";
import {PipelineHashProvider} from "../hashing/PipelineHashProvider.ts";

export type FacePass = "single" | "back" | "front"

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