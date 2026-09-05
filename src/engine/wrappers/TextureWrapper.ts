import type {ImageWrapper} from "./ImageWrapper.ts";
import type {SamplerWrapper} from "./SamplerWrapper.ts";
import { v4 as uuidv4 } from "uuid";
import type {Hasher} from "../hashing/Hasher.ts";
import {AggregateHashHandler} from "../hashing/AggregateHashHandler.ts";

export class TextureWrapper {
    private image!: ImageWrapper;
    private sampler!: SamplerWrapper;
    readonly uuid: string;

    private hashHandler: AggregateHashHandler;

    constructor() {
        this.uuid = uuidv4();
        this.hashHandler = new AggregateHashHandler((hasher) =>
            `${this.image.convertToHash(hasher)}|${this.sampler.convertToHash(hasher)}`
        );
    }

    getImage(): ImageWrapper {
        return this.image;
    }

    setImage(image: ImageWrapper): void {
        this.image = image;
    }

    getSampler(): SamplerWrapper {
        return this.sampler;
    }

    setSampler(sampler: SamplerWrapper): void {
        this.sampler = sampler;
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }

    drainTrash(): string[] {
        return this.hashHandler.drainTrash();
    }
}