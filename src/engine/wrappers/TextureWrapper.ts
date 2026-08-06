import type {ImageWrapper} from "./ImageWrapper.ts";
import type {SamplerWrapper} from "./SamplerWrapper.ts";

export class TextureWrapper {

    private image: ImageWrapper;
    private sampler: SamplerWrapper

    constructor() {
    }

    setImage(image: ImageWrapper): void {
        this.image = image;
    }

    setSampler(sampler: SamplerWrapper): void {
        this.sampler = sampler;
    }
}