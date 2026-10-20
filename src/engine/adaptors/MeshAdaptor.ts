import {MeshInternal} from "../internals/MeshInternal.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";

export class MeshAdaptor {
    readonly internal: MeshInternal;

    constructor() {
        this.internal = new MeshInternal();
    }


    setPrimitive(primitive: PrimitiveWrapper) {
        this.internal.setPrimitive(primitive.adaptor.internal)
    }

    removePrimitive(uuid: string): void {
        this.internal.removePrimitive(uuid);
    }
}