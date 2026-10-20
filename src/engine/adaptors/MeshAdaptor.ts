import {MeshInternal} from "../internals/MeshInternal.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {PrimitiveAdaptor} from "./PrimitiveAdaptor.ts";
import {Source} from "./Source.ts";

export class MeshAdaptor {
    readonly internal: MeshInternal;

    /** Fires when a primitive was added or removed. Nodes using this mesh rebuild their pipelines. */
    readonly changed = new Source<void>();

    private readonly primitiveAdaptors = new Map<string, PrimitiveAdaptor>();
    private cachedPrimitiveAdaptors: PrimitiveAdaptor[] = [];

    constructor() {
        this.internal = new MeshInternal();
    }

    getPrimitiveAdaptors(): readonly PrimitiveAdaptor[] {
        return this.cachedPrimitiveAdaptors;
    }

    setPrimitive(primitive: PrimitiveWrapper) {
        const adaptor = primitive.adaptor;
        this.primitiveAdaptors.set(adaptor.internal.uuid, adaptor);
        this.cachedPrimitiveAdaptors = Array.from(this.primitiveAdaptors.values());
        this.internal.setPrimitive(adaptor.internal);
        this.changed.notify();
    }

    /** @param uuid the uuid of the primitive's internal (not the wrapper's) */
    removePrimitive(uuid: string): void {
        this.primitiveAdaptors.delete(uuid);
        this.cachedPrimitiveAdaptors = Array.from(this.primitiveAdaptors.values());
        this.internal.removePrimitive(uuid);
        this.changed.notify();
    }
}
