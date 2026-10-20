import {PrimitiveInternal} from "../internals/PrimitiveInternal.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";

export class PrimitiveAdaptor {
    readonly internal: PrimitiveInternal;

    constructor() {
        this.internal = new PrimitiveInternal();
    }

    setMaterial(material: MaterialWrapper): void {
        this.internal.setMat(material.adaptor.internal)
    }

    setGeometry(geometry: GeometryWrapper): void {
        this.internal.setGeo(geometry.adaptor.internal)
    }
}