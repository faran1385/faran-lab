import { v4 as uuidv4 } from "uuid";
import type {Sampler} from "../importers/utils/IR.ts";
import type {Hasher} from "../hashing/Hasher.ts";

export class SamplerWrapper {
    private minFilter: Sampler["minFilter"];
    private magFilter: Sampler["magFilter"];
    private mipFilter: Sampler["mipFilter"];
    private addressModeU: Sampler["addressModeU"];
    private addressModeV: Sampler["addressModeV"];
    readonly uuid: string;

    private version = 0;
    private cachedHash?: string;
    private cachedVersion = -1;

    constructor(
        minFilter: Sampler["minFilter"],
        magFilter: Sampler["magFilter"],
        mipFilter: Sampler["mipFilter"],
        addressModeU: Sampler["addressModeU"],
        addressModeV: Sampler["addressModeV"]
    ) {
        this.minFilter = minFilter;
        this.magFilter = magFilter;
        this.mipFilter = mipFilter;
        this.addressModeU = addressModeU;
        this.addressModeV = addressModeV;

        this.uuid = uuidv4();
    }

    getMinFilter(): Sampler["minFilter"] {
        return this.minFilter;
    }

    setMinFilter(minFilter: Sampler["minFilter"]): void {
        this.minFilter = minFilter;
        this.version++;
    }

    getMagFilter(): Sampler["magFilter"] {
        return this.magFilter;
    }

    setMagFilter(magFilter: Sampler["magFilter"]): void {
        this.magFilter = magFilter;
        this.version++;
    }

    getMipFilter(): Sampler["mipFilter"] {
        return this.mipFilter;
    }

    setMipFilter(mipFilter: Sampler["mipFilter"]): void {
        this.mipFilter = mipFilter;
        this.version++;
    }

    getAddressModeU(): Sampler["addressModeU"] {
        return this.addressModeU;
    }

    setAddressModeU(addressModeU: Sampler["addressModeU"]): void {
        this.addressModeU = addressModeU;
        this.version++;
    }

    getAddressModeV(): Sampler["addressModeV"] {
        return this.addressModeV;
    }

    setAddressModeV(addressModeV: Sampler["addressModeV"]): void {
        this.addressModeV = addressModeV;
        this.version++;
    }

    convertToHash(hasher: Hasher): string {
        if (this.cachedHash !== undefined && this.cachedVersion === this.version) {
            return this.cachedHash;
        }

        const hash = hasher.hashString(
            `${this.minFilter}|${this.magFilter}|${this.mipFilter}|${this.addressModeU}|${this.addressModeV}`
        );

        this.cachedHash = hash;
        this.cachedVersion = this.version;
        return hash;
    }
}