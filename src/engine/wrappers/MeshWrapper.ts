import type {PrimitiveWrapper} from "./PrimitiveWrapper.ts";
import { v4 as uuidv4 } from "uuid";
import {ChangeStamp} from "../hashing/ChangeStamp.ts";

export class MeshWrapper {
    readonly uuid: string;

    private primitives = new Map<string, PrimitiveWrapper>();
    private readonly changeStamp = new ChangeStamp();

    constructor() {
        this.uuid = uuidv4();
    }

    getPrimitive(uuid: string): PrimitiveWrapper | undefined {
        return this.primitives.get(uuid);
    }

    setPrimitive(wrapper: PrimitiveWrapper): void {
        this.primitives.set(wrapper.uuid, wrapper);
        this.changeStamp.mark();
    }

    /** Stamp of the primitive list itself (not of the primitives' contents). */
    getChangedAt(): number {
        return this.changeStamp.get();
    }

    getAllPrimitives(): PrimitiveWrapper[] {
        return Array.from(this.primitives.values());
    }
}