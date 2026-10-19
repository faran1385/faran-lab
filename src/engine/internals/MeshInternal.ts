import type {PrimitiveInternal} from "./PrimitiveInternal.ts";
import {v4 as uuidv4} from "uuid";

export class MeshInternal {
    readonly uuid: string;
    private primitives = new Map<string, PrimitiveInternal>();

    constructor() {
        this.uuid = uuidv4()
    }


    setPrimitive(primitive: PrimitiveInternal) {
        this.primitives.set(primitive.uuid, primitive);
    }

    removePrimitive(uuid: string) {
        this.primitives.delete(uuid);
    }
}