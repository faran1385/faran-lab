import {HashHandler} from "./utils/HashHandler.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";
import type {Hasher} from "./utils/Hasher.ts";

type InputFunctions = {
    getMinFilter: () => string,
    getMagFilter: () => string,
    getMipFilter: () => string,
    getAddressModeU: () => string,
    getAddressModeV: () => string,
}

export class SamplerHashProvider {
    protected hashHandler!: HashHandler;
    private readonly changeStamp = new ChangeStamp();

    constructor(T: InputFunctions) {
        this.hashHandler = new HashHandler(() => `${T.getMinFilter()}|${T.getMinFilter()}|${T.getMipFilter()}|${T.getAddressModeU()}|${T.getAddressModeV()}`);
    }

    markHashHandler() {
        this.hashHandler.addVersion()
    }

    markChangeStamp() {
        this.changeStamp.mark();
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }

    getChangedAt(): number {
        return this.changeStamp.get();
    }
}