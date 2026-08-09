import type {ImageWrapper} from "./ImageWrapper.ts";
import type {SamplerWrapper} from "./SamplerWrapper.ts";
import { v4 as uuidv4 } from "uuid";
import type {Hasher} from "../hashing/Hasher.ts";

export class TextureWrapper {
    private image!: ImageWrapper;
    private sampler!: SamplerWrapper;
    readonly uuid: string;

    constructor() {
        this.uuid = uuidv4();
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
        const imageHash = this.image.convertToHash(hasher);
        const samplerHash = this.sampler?.convertToHash(hasher) ?? "none";

        return hasher.hashString(`${imageHash}|${samplerHash}`);
    }
}