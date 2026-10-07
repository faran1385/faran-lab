import {HashHandler} from "./utils/HashHandler.ts";
import type {Hasher} from "./utils/Hasher.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";
import {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import {VersionFlag} from "./utils/VersionFlag.ts";

export class ImageHashProvider {
    protected hashHandler!: HashHandler;
    private readonly changeStamp = new ChangeStamp();
    private needsUpdateFlag = new VersionFlag()

    constructor(uuid: string, getDimentions: ImageWrapper["getDimensions"], getFormat: ImageWrapper["getFormat"]) {
        this.hashHandler = new HashHandler(() => `${uuid}|${getDimentions().width}|${getDimentions().height}|${getFormat()}`);

    }


    markNeedsUpdate() {
        this.needsUpdateFlag.addVersion()
    }

    syncNeedsUpdate() {
        this.needsUpdateFlag.sync();
    }

    needsUpdate() {
        return this.needsUpdateFlag.needsUpdate();
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