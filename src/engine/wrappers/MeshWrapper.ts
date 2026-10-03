import type {PrimitiveWrapper} from "./PrimitiveWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {MeshHashProvider} from "../hashing/MeshHashProvider.ts";

export class MeshWrapper {
    readonly uuid: string;

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
        this.hashProvider.markStamp();
        this.updateCachedPrimitiveArray()
    }

    removePrimitive(uuid: string): void {
        this.primitives.delete(uuid);
        this.hashProvider.markStamp();
        this.updateCachedPrimitiveArray()
    }


    getAllPrimitives() {
        return this._cachedPrimitiveArray
    }

    getPrimitivesCount() {
        return this.primitives.size;
    }
}