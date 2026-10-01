import {v4 as uuidv4} from "uuid";
import type {Sampler} from "../importers/utils/IR.ts";
import {SamplerHashProvider} from "../hashing/SamplerHashProvider.ts";

export class SamplerWrapper {
    private minFilter: Sampler["minFilter"];
    private magFilter: Sampler["magFilter"];
    private mipFilter: Sampler["mipFilter"];
    private addressModeU: Sampler["addressModeU"];
    private addressModeV: Sampler["addressModeV"];
    readonly uuid: string;

    readonly hashProvider: SamplerHashProvider;

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

        this.hashProvider = new SamplerHashProvider({
            getAddressModeV: this.getAddressModeV.bind(this),
            getMipFilter: this.getMipFilter.bind(this),
            getAddressModeU: this.getAddressModeU.bind(this),
            getMagFilter: this.getMagFilter.bind(this),
            getMinFilter: this.getMinFilter.bind(this),
        })
    }

    getMinFilter(): Sampler["minFilter"] {
        return this.minFilter;
    }

    setMinFilter(minFilter: Sampler["minFilter"]): void {
        this.minFilter = minFilter;
        this.hashProvider.markHashHandler()
        this.hashProvider.markChangeStamp()
    }

    getMagFilter(): Sampler["magFilter"] {
        return this.magFilter;
    }

    setMagFilter(magFilter: Sampler["magFilter"]): void {
        this.magFilter = magFilter;
        this.hashProvider.markHashHandler()
        this.hashProvider.markChangeStamp()
    }

    getMipFilter(): Sampler["mipFilter"] {
        return this.mipFilter;
    }

    setMipFilter(mipFilter: Sampler["mipFilter"]): void {
        this.mipFilter = mipFilter;
        this.hashProvider.markHashHandler()
        this.hashProvider.markChangeStamp()
    }

    getAddressModeU(): Sampler["addressModeU"] {
        return this.addressModeU;
    }

    setAddressModeU(addressModeU: Sampler["addressModeU"]): void {
        this.addressModeU = addressModeU;
        this.hashProvider.markHashHandler()
        this.hashProvider.markChangeStamp()
    }

    getAddressModeV(): Sampler["addressModeV"] {
        return this.addressModeV;
    }

    setAddressModeV(addressModeV: Sampler["addressModeV"]): void {
        this.addressModeV = addressModeV;
        this.hashProvider.markHashHandler()
        this.hashProvider.markChangeStamp()
    }

}