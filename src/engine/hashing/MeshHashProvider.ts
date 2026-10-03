import {ChangeStamp} from "./utils/ChangeStamp.ts";

export class MeshHashProvider {
    private readonly changeStamp = new ChangeStamp();

    markStamp(){
        this.changeStamp.mark();
    }

    /** Stamp of the primitive list itself (not of the primitives' contents). */
    getChangedAt(): number {
        return this.changeStamp.get();
    }

}