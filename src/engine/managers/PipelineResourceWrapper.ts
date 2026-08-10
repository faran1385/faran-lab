import {GPUResourceWrapper} from "./GPUResourceWrapper.ts";

export class PipelineResourceWrapper extends GPUResourceWrapper<GPURenderPipeline> {
    dispose(): void {
        // GPURenderPipeline has no destroy() — dropping the reference is sufficient
    }
}