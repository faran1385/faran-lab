import type {PrimitiveWrapper} from "./PrimitiveWrapper.ts";
import {v4 as uuidv4} from "uuid";

export class MeshWrapper {
    readonly uuid: string;

    private primitives = new Map<string, PrimitiveWrapper>();

    constructor() {
        this.uuid = uuidv4();
    }

    setPrimitive(wrapper: PrimitiveWrapper) {
        this.primitives.set(wrapper.uuid, wrapper);
    }
}