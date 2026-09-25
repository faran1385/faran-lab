import type {PrimitiveWrapper} from "./PrimitiveWrapper.ts";
import { v4 as uuidv4 } from "uuid";

export class MeshWrapper {
    readonly uuid: string;

    private primitives = new Map<string, PrimitiveWrapper>();

    constructor() {
        this.uuid = uuidv4();
    }

    getPrimitive(uuid: string): PrimitiveWrapper | undefined {
        return this.primitives.get(uuid);
    }

    setPrimitive(wrapper: PrimitiveWrapper): void {
        this.primitives.set(wrapper.uuid, wrapper);
    }

    getAllPrimitives(): PrimitiveWrapper[] {
        return Array.from(this.primitives.values());
    }
}