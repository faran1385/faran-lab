import {ResourceManager} from "./Manager.ts";
import {ShaderModuleTracker} from "../Trackers/Trackers.ts";
import type {ShaderModuleWrapper} from "../wrappers/ShaderModuleWrapper.ts";

interface ShaderModuleCreationInput {
    code: string;
    hash: string;
}

export class ShaderModuleManager extends ResourceManager<ShaderModuleCreationInput, GPUShaderModule, ShaderModuleTracker> {
    createOrGetFromSource(shaderWrapper: ShaderModuleWrapper): ShaderModuleTracker {
        return this.createOrGet({
            hash: shaderWrapper.convertToHash(this.hasher),
            code:shaderWrapper.getCode()
        });
    }

    protected getHash(input: ShaderModuleCreationInput): string {
        return input.hash;
    }

    protected createResource(input: ShaderModuleCreationInput): GPUShaderModule {
        return this.device.createShaderModule({code: input.code});
    }

    protected createTracker(resource: GPUShaderModule): ShaderModuleTracker {
        return new ShaderModuleTracker(resource);
    }
}