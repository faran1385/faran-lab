import type {ImageWrapper} from "./ImageWrapper.ts";
import type {SamplerWrapper} from "./SamplerWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {TextureHashProvider} from "../hashing/TextureHashProvider.ts";

export class TextureWrapper {
    private image!: ImageWrapper;
    private sampler!: SamplerWrapper;
    readonly uuid: string;
    readonly hashProvider: TextureHashProvider;


    constructor(image: ImageWrapper, sampler: SamplerWrapper) {
        this.uuid = uuidv4();
        this.image = image;
        this.sampler = sampler;
        this.hashProvider = new TextureHashProvider({
            getImage: this.getImage.bind(this),
            getSampler: this.getSampler.bind(this),
        })
    }

    getImage(): ImageWrapper {
        return this.image;
    }

    setImage(image: ImageWrapper): void {
        this.image = image;
        this.hashProvider.markChangeStamp()
    }

    getSampler(): SamplerWrapper {
        return this.sampler;
    }

    setSampler(sampler: SamplerWrapper): void {
        this.sampler = sampler;
        this.hashProvider.markChangeStamp()
    }


}