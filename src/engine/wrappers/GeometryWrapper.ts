import {v4 as uuidv4} from "uuid";
import type {AttributeWrapper} from "./AttributeWrapper.ts";
import type {IndexAttributeWrapper} from "./IndexWrapper.ts";
import type {MorphTargetWrapper} from "./MorphTargetWrapper.ts";
import {GeometryAdaptor} from "../Adaptors/GeometryAdaptor.ts";

export class GeometryWrapper {
    readonly uuid: string;
    readonly adaptor = new GeometryAdaptor(this);

    private attributes: Map<string, AttributeWrapper> = new Map();
    private indices?: IndexAttributeWrapper;
    private morphTargets?: MorphTargetWrapper;


    constructor() {
        this.uuid = uuidv4();
    }

    setAttribute(attribute: AttributeWrapper) {
        const current = this.attributes.get(attribute.name);

        // Same format and byte length means the GPU allocation and vertex layout remain valid.
        // Preserve the existing wrapper/internal identity and enqueue an in-place data upload.
        if (current && current.format === attribute.format
            && current.getData().byteLength === attribute.getData().byteLength) {
            current.setData(attribute.getData());
            return;
        }

        this.attributes.set(attribute.name, attribute);
        this.adaptor.invalidate();
    }

    removeAttribute(name: string) {
        this.attributes.delete(name)
        this.adaptor.invalidate();
    }

    setIndices(indices: IndexAttributeWrapper) {
        this.indices = indices;
        this.adaptor.invalidate();
    }

    clearIndices() {
        this.indices = undefined;
        this.adaptor.invalidate();
    }

    getIndices() {
        return this.indices;
    }

    /**
     * Attaches the morph targets (or removes them with null). The deltas are added to this geometry's own
     * position/normal/tangent attributes, so the vertex count must match the position attribute. The targets are shared
     * data (one GPU buffer for every node drawing this geometry); per-node weights live in a MorphStateWrapper on the node.
     */
    setMorphTargets(targets: MorphTargetWrapper | null) {
        this.morphTargets = targets ?? undefined;
        this.adaptor.invalidate();
    }

    getMorphTargets() {
        return this.morphTargets;
    }

    getAttributes() {
        return this.attributes;
    }

    getAttribute(name: string) {
        return this.attributes.get(name)
    }

}