import type {PrimitiveWrapper} from "./PrimitiveWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {MeshAdaptor} from "../Adaptors/MeshAdaptor.ts";

export class MeshWrapper {
    readonly uuid: string;
    readonly adaptor = new MeshAdaptor();

    private primitives = new Map<string, PrimitiveWrapper>();
    private _cachedPrimitiveArray: PrimitiveWrapper[] = []


    constructor() {
        this.uuid = uuidv4();
    }

    private updateCachedPrimitiveArray() {
        this._cachedPrimitiveArray = Array.from(this.primitives.values());
    }

    getPrimitive(uuid: string): PrimitiveWrapper | undefined {
        return this.primitives.get(uuid);
    }

    setPrimitive(wrapper: PrimitiveWrapper): void {
        this.primitives.set(wrapper.uuid, wrapper);
        this.adaptor.setPrimitive(wrapper);

        this.updateCachedPrimitiveArray()
    }

    removePrimitive(uuid: string): void {
        const primitive=this.primitives.get(uuid)!;
        this.primitives.delete(uuid);

        this.adaptor.removePrimitive(primitive.adaptor.internal.uuid);
        this.updateCachedPrimitiveArray()
    }

    getAllPrimitives() {
        return this._cachedPrimitiveArray
    }
}