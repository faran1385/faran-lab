import {HashHandler} from "./utils/HashHandler.ts";
import type {Hasher} from "./utils/Hasher.ts";
import {VersionFlag} from "./utils/VersionFlag.ts";

type InputFunctions = {
    getCode: () => string
}

export class ShaderModuleHashProvider {
    protected hashHandler: HashHandler;
    readonly versionFlag = new VersionFlag();

    constructor(T: InputFunctions) {
        this.hashHandler = new HashHandler(() => T.getCode());
    }

    markHashHandler() {
        this.hashHandler.addVersion()
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }

    needsUpdateCodeGen() {
        return this.versionFlag.needsUpdate()
    }

    syncCodeGen() {
        this.versionFlag.sync()
    }

    markCodeGen() {
        this.versionFlag.addVersion()
    }
}