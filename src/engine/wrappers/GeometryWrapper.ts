import {v4 as uuidv4} from "uuid";
import type {AttributeWrapper} from "./AttributeWrapper.ts";
import type {IndexAttributeWrapper} from "./IndexWrapper.ts";
import type {MorphTargetWrapper} from "./MorphTargetWrapper.ts";
import {GeometryAdaptor} from "../Adaptors/GeometryAdaptor.ts";
import {VATTextureWrapper} from "./VATTextureWrapper.ts";

export class GeometryWrapper {
    readonly uuid: string;
    readonly adaptor = new GeometryAdaptor(this);

    private attributes: Map<string, AttributeWrapper> = new Map();
    private indices?: IndexAttributeWrapper;
    private morphTarget?: MorphTargetWrapper;
    private VATTextures = new Map<string, VATTextureWrapper>();

    constructor() {
        this.uuid = uuidv4();

    }

    private setVATTexture(name: string, vatWrapper: VATTextureWrapper) {
        this.VATTextures.set(name, vatWrapper);
        this.adaptor.invalidateVATs();
    }

    private removeVATTexture(name: string) {
        this.VATTextures.delete(name);
        this.adaptor.invalidateVATs();
    }

    getVATs(): ReadonlyMap<string, VATTextureWrapper> {
        return this.VATTextures;
    }

    setPositionVAT(vat: VATTextureWrapper) {
        this.setVATTexture("position", vat);
    }

    setNormalVAT(vat: VATTextureWrapper) {
        this.setVATTexture("normal", vat);
    }

    removePositionVAT() {
        this.removeVATTexture("position")
    }

    removeNormalVAT() {
        this.removeVATTexture("normal")
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
        this.adaptor.invalidateAttributes(attribute.name);
    }

    removeAttribute(name: string) {
        if (!this.attributes.delete(name)) return;
        this.adaptor.invalidateAttributes(name);
    }

    setIndices(indices: IndexAttributeWrapper) {
        this.indices = indices;
        this.adaptor.invalidateIndices();
    }

    clearIndices() {
        if (!this.indices) return;
        this.indices = undefined;
        this.adaptor.invalidateIndices();
    }

    getIndices() {
        return this.indices;
    }

    /**
     * Attaches the morph targets (or removes them with null). The deltas are added to this geometry's own
     * position/normal/tangent attributes, so the vertex count must match the position attribute. The targets are shared
     * data (one GPU buffer for every node drawing this geometry); per-node weights live in a MorphStateWrapper on the node.
     */
    setMorphTarget(target: MorphTargetWrapper | null) {
        const next = target ?? undefined;
        if (this.morphTarget === next) return;
        this.morphTarget = next;
        this.adaptor.invalidateMorphTargets();
    }

    getMorphTarget() {
        return this.morphTarget;
    }

    getAttributes() {
        return this.attributes;
    }

    getAttribute(name: string) {
        return this.attributes.get(name)
    }

}
