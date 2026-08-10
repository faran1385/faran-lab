import {GPUResourceWrapper} from "./GPUResourceWrapper.ts";

export class ShaderModuleResourceWrapper extends GPUResourceWrapper<GPUShaderModule> {
    dispose(): void {
        // GPUShaderModule has no destroy() — dropping the reference is sufficient
    }
}