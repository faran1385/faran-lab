import type {PrimitiveWrapper} from "./PrimitiveWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {MeshHashProvider} from "../hashing/MeshHashProvider.ts";
import {MeshAdaptor} from "../adaptors/MeshAdaptor.ts";

export class MeshWrapper {
    readonly uuid: string;
    readonly adaptor = new MeshAdaptor();

    private primitives = new Map<string, PrimitiveWrapper>();
    private _cachedPrimitiveArray: PrimitiveWrapper[] = []
    readonly hashProvider: MeshHashProvider;


    constructor() {
        this.uuid = uuidv4();
        this.hashProvider = new MeshHashProvider();
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

        this.hashProvider.markStamp();
        this.updateCachedPrimitiveArray()
    }

    removePrimitive(uuid: string): void {
        const primitive=this.primitives.get(uuid)!;
        this.primitives.delete(uuid);

        this.adaptor.removePrimitive(primitive.adaptor.internal.uuid);
        this.hashProvider.markStamp();
        this.updateCachedPrimitiveArray()
    }

    getAllPrimitives() {
        return this._cachedPrimitiveArray
    }
}