import {GPUResourceWrapper} from "./GPUResourceWrapper.ts";

export class BufferResourceWrapper extends GPUResourceWrapper<GPUBuffer> {
    dispose(): void {
        this.resource.destroy();
    }
}