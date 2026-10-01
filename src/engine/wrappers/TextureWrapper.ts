import type {ImageWrapper} from "./ImageWrapper.ts";
import type {SamplerWrapper} from "./SamplerWrapper.ts";
import {v4 as uuidv4} from "uuid";
import type {Hasher} from "../hashing/Hasher.ts";
import {AggregateHashHandler} from "../hashing/AggregateHashHandler.ts";
import {ChangeStamp} from "../hashing/ChangeStamp.ts";

export class TextureWrapper {
    private image!: ImageWrapper;
    private sampler!: SamplerWrapper;
    readonly uuid: string;

    private hashHandler: AggregateHashHandler;
    private readonly changeStamp = new ChangeStamp();

    constructor(image: ImageWrapper, sampler: SamplerWrapper) {
        this.uuid = uuidv4();
        this.image = image;
        this.sampler = sampler;
        this.hashHandler = new AggregateHashHandler((hasher) =>
            `${this.image.convertToHash(hasher)}|${this.sampler.convertToHash(hasher)}`
        );
    }

    getImage(): ImageWrapper {
        return this.image;
    }

    setImage(image: ImageWrapper): void {
        this.image = image;
        this.changeStamp.mark();
    }

    getSampler(): SamplerWrapper {
        return this.sampler;
    }

    setSampler(sampler: SamplerWrapper): void {
        this.sampler = sampler;
        this.changeStamp.mark();
    }

    /** Latest change stamp of this texture or of anything it is built from. */
    getChangedAt(): number {
        return Math.max(this.changeStamp.get(), this.image.getChangedAt(), this.sampler.getChangedAt());
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }
}