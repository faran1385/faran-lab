import {v4 as uuidv4} from "uuid";
import type {AttributeWrapper} from "./AttributeWrapper.ts";
import type {IndexAttributeWrapper} from "./IndexWrapper.ts";
import {GeometryHashHandler} from "../hashing/GeometryHashHandler.ts";
import type {Hasher} from "../hashing/Hasher.ts";
import {ChangeStamp} from "../hashing/ChangeStamp.ts";
import {getEpoch} from "../hashing/epoch.ts";

export class GeometryWrapper {
    readonly uuid: string;

    private attributes: Map<string, AttributeWrapper> = new Map();
    private indices?: IndexAttributeWrapper;
    private hashHandler: GeometryHashHandler;
    private readonly changeStamp = new ChangeStamp();
    private memoEpoch = -1;
    private memoChangedAt = 0;

    constructor() {
        this.uuid = uuidv4();
        this.hashHandler = new GeometryHashHandler()
    }

    setAttribute(attribute: AttributeWrapper) {
        this.attributes.set(attribute.name, attribute);
        this.hashHandler.sortAttributes(this.attributes)
        this.changeStamp.mark();
    }

    removeAttribute(name: string) {
        this.attributes.delete(name)
        this.hashHandler.sortAttributes(this.attributes)
        this.changeStamp.mark();
    }

    setIndices(indices: IndexAttributeWrapper) {
        this.indices = indices;
        this.changeStamp.mark();
    }

    clearIndices() {
        this.indices = undefined;
        this.changeStamp.mark();
    }

    getIndices() {
        return this.indices;
    }

    getAttributes() {
        return this.attributes;
    }

    /** Latest change stamp of this geometry or of any of its attribute / index buffers. */
    getChangedAt(): number {
        const epoch = getEpoch();
        if (this.memoEpoch === epoch) return this.memoChangedAt;

        let at = this.changeStamp.get();
        for (const attribute of this.attributes.values()) {
            const attributeAt = attribute.getChangedAt();
            if (attributeAt > at) at = attributeAt;
        }
        if (this.indices) at = Math.max(at, this.indices.getChangedAt());

        this.memoEpoch = epoch;
        this.memoChangedAt = at;
        return at;
    }

    convertToAttributesHash(hasher: Hasher): string {
        return this.hashHandler.convertToAttributesHash(hasher);
    }

    convertToAttributesShapeHash(hasher: Hasher): string {
        return this.hashHandler.convertToAttributesShapeHash(hasher);
    }

    syncAttributesHash() {
        return this.hashHandler.syncAttributesHash()
    }

    needsShaderRebuild(hasher: Hasher) {
        return this.hashHandler.needsShaderRebuild(hasher)
    }
}