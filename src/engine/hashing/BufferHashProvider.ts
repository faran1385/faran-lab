import {VersionFlag} from "./utils/VersionFlag.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";

export class BufferHashProvider {
    private needsUpdateFlag = new VersionFlag(false)
    private wrapperUUID: string
    private readonly changeStamp = new ChangeStamp();

    constructor(uuid: string) {
        this.wrapperUUID = uuid;
    }


    getChangedAt(): number {
        return this.changeStamp.get();
    }

    markChangeStamp() {
        this.changeStamp.mark();
    }

    convertToHash() {
        return this.wrapperUUID
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
}