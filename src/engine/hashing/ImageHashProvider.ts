import {HashHandler} from "./utils/HashHandler.ts";
import type {Hasher} from "./utils/Hasher.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";

export class ImageHashProvider {
    protected hashHandler!: HashHandler;
    private readonly changeStamp = new ChangeStamp();

    constructor(uuid: string) {
        this.hashHandler = new HashHandler(() => `${uuid}|${this.hashHandler.getVersion()}`);

    }

    markHashHandler(){
        this.hashHandler.addVersion()
    }

    markChangeStamp(){
        this.changeStamp.mark();
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }

    getChangedAt(): number {
        return this.changeStamp.get();
    }
}