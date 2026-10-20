import type {PrimitiveInternal} from "./PrimitiveInternal.ts";
import {v4 as uuidv4} from "uuid";
import {MeshInternalHashProvider} from "../hashing/MeshInternalHashProvider.ts";

export class MeshInternal {
    readonly uuid: string;
    private primitives = new Map<string, PrimitiveInternal>();
    readonly hashProvider: MeshInternalHashProvider;
    private _cachedPrimitiveArray: PrimitiveInternal[] = []


    constructor() {
        this.uuid = uuidv4()
        this.hashProvider = new MeshInternalHashProvider({getPrimitives: () => this.primitives});
    }

    private updateCachedPrimitiveArray() {
        this._cachedPrimitiveArray = Array.from(this.primitives.values());
    }


    setPrimitive(primitive: PrimitiveInternal) {
        this.primitives.set(primitive.uuid, primitive);
        this.hashProvider.markChanged();
        this.updateCachedPrimitiveArray()
    }

    getAllPrimitives() {
        return this._cachedPrimitiveArray
    }


    removePrimitive(uuid: string) {
        this.primitives.delete(uuid);
        this.hashProvider.markChanged();
        this.updateCachedPrimitiveArray()
    }
}