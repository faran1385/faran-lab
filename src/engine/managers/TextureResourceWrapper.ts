import {GPUResourceWrapper} from "./GPUResourceWrapper.ts";


export class TextureResourceWrapper extends GPUResourceWrapper<GPUTexture> {
    dispose(): void {
        this.resource.destroy();
    }
}