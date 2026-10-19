import type {PrimitiveInternal} from "./PrimitiveInternal.ts";
import {v4 as uuidv4} from "uuid";
import {MeshInternalHashProvider} from "../hashing/MeshInternalHashProvider.ts";

export class MeshInternal {
    readonly uuid: string;
    private primitives = new Map<string, PrimitiveInternal>();
    readonly hashProvider: MeshInternalHashProvider;

    constructor() {
        this.uuid = uuidv4()
        this.hashProvider = new MeshInternalHashProvider({getPrimitives: () => this.primitives});
    }


    setPrimitive(primitive: PrimitiveInternal) {
        this.primitives.set(primitive.uuid, primitive);
        this.hashProvider.markChanged();
    }

    removePrimitive(uuid: string) {
        this.primitives.delete(uuid);
        this.hashProvider.markChanged();
    }
}