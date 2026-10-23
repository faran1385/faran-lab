import type {ImageWrapper} from "./ImageWrapper.ts";
import type {SamplerWrapper} from "./SamplerWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {TextureAdaptor} from "../Adaptors/TextureAdaptor.ts";

export class TextureWrapper {
    private image!: ImageWrapper;
    private sampler!: SamplerWrapper;
    readonly uuid: string;
    readonly adaptor: TextureAdaptor;

    constructor(image: ImageWrapper, sampler: SamplerWrapper) {
        this.uuid = uuidv4();
        this.image = image;
        this.sampler = sampler;
        this.adaptor = new TextureAdaptor();

    }

    getImage(): ImageWrapper {
        return this.image;
    }

    setImage(image: ImageWrapper): void {
        if (this.image === image) return;
        this.image = image;
        this.adaptor.onTextureChange()
    }

    getSampler(): SamplerWrapper {
        return this.sampler;
    }

    setSampler(sampler: SamplerWrapper): void {
        if (this.sampler === sampler) return;
        this.sampler = sampler;
        this.adaptor.onTextureChange()
    }


}