import {v4 as uuidv4} from "uuid";
import type {AttributeWrapper} from "./AttributeWrapper.ts";
import type {IndexAttributeWrapper} from "./IndexWrapper.ts";
import {GeometryHashHandler} from "../hashing/GeometryHashHandler.ts";
import type {Hasher} from "../hashing/Hasher.ts";

export class GeometryWrapper {
    readonly uuid: string;

    private attributes: Map<string, AttributeWrapper> = new Map();
    private indices?: IndexAttributeWrapper;
    private hashHandler: GeometryHashHandler;

    constructor() {
        this.uuid = uuidv4();
        this.hashHandler = new GeometryHashHandler()
    }

    addAttribute(attribute: AttributeWrapper) {
        this.attributes.set(attribute.name, attribute);
        this.hashHandler.sortAttributes(this.attributes)
    }

    removeAttribute(name: string) {
        this.attributes.delete(name)
        this.hashHandler.sortAttributes(this.attributes)
    }

    setIndices(indices: IndexAttributeWrapper) {
        this.indices = indices;
    }

    clearIndices() {
        this.indices = undefined;
    }

    getIndices() {
        return this.indices;
    }

    getAttributes() {
        return this.attributes;
    }

    convertToAttributesHash(hasher: Hasher): string {
        return this.hashHandler.convertToAttributesHash(hasher);
    }

    syncAttributesHash() {
        return this.hashHandler.syncAttributesHash()
    }

    needsShaderRebuild(hasher: Hasher) {
        return this.hashHandler.needsShaderRebuild(hasher)
    }
}