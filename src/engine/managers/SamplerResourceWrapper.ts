import {GPUResourceWrapper} from "./GPUResourceWrapper.ts";

export class SamplerResourceWrapper extends GPUResourceWrapper<GPUSampler> {
    dispose(): void {
        // GPUSampler has no destroy() — dropping the reference is sufficient
    }
}