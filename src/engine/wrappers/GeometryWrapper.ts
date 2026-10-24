import {v4 as uuidv4} from "uuid";
import type {AttributeWrapper} from "./AttributeWrapper.ts";
import type {IndexAttributeWrapper} from "./IndexWrapper.ts";
import {GeometryAdaptor} from "../Adaptors/GeometryAdaptor.ts";

export class GeometryWrapper {
    readonly uuid: string;
    readonly adaptor = new GeometryAdaptor(this);

    private attributes: Map<string, AttributeWrapper> = new Map();
    private indices?: IndexAttributeWrapper;


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

    getAttributes() {
        return this.attributes;
    }

    getAttribute(name: string) {
        return this.attributes.get(name)
    }

}