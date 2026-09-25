import {v4 as uuidv4} from "uuid";
import type {Sampler} from "../importers/utils/IR.ts";
import type {Hasher} from "../hashing/Hasher.ts";
import {HashHandler} from "../hashing/HashHandler.ts";

export class SamplerWrapper {
    private minFilter: Sampler["minFilter"];
    private magFilter: Sampler["magFilter"];
    private mipFilter: Sampler["mipFilter"];
    private addressModeU: Sampler["addressModeU"];
    private addressModeV: Sampler["addressModeV"];
    readonly uuid: string;

    private hashHandler: HashHandler;

    constructor(
        minFilter: Sampler["minFilter"] = "linear",
        magFilter: Sampler["magFilter"] = "linear",
        mipFilter: Sampler["mipFilter"] = "linear",
        addressModeU: Sampler["addressModeU"] = "clamp-to-edge",
        addressModeV: Sampler["addressModeV"] = "clamp-to-edge",
    ) {
        this.minFilter = minFilter;
        this.magFilter = magFilter;
        this.mipFilter = mipFilter;
        this.addressModeU = addressModeU;
        this.addressModeV = addressModeV;

        this.uuid = uuidv4();

        this.hashHandler = new HashHandler(() => `${this.minFilter}|${this.magFilter}|${this.mipFilter}|${this.addressModeU}|${this.addressModeV}`);
    }

    getMinFilter(): Sampler["minFilter"] {
        return this.minFilter;
    }

    setMinFilter(minFilter: Sampler["minFilter"]): void {
        this.minFilter = minFilter;
        this.hashHandler.addVersion();
    }

    getMagFilter(): Sampler["magFilter"] {
        return this.magFilter;
    }

    setMagFilter(magFilter: Sampler["magFilter"]): void {
        this.magFilter = magFilter;
        this.hashHandler.addVersion();
    }

    getMipFilter(): Sampler["mipFilter"] {
        return this.mipFilter;
    }

    setMipFilter(mipFilter: Sampler["mipFilter"]): void {
        this.mipFilter = mipFilter;
        this.hashHandler.addVersion();
    }

    getAddressModeU(): Sampler["addressModeU"] {
        return this.addressModeU;
    }

    setAddressModeU(addressModeU: Sampler["addressModeU"]): void {
        this.addressModeU = addressModeU;
        this.hashHandler.addVersion();
    }

    getAddressModeV(): Sampler["addressModeV"] {
        return this.addressModeV;
    }

    setAddressModeV(addressModeV: Sampler["addressModeV"]): void {
        this.addressModeV = addressModeV;
        this.hashHandler.addVersion();
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }
}