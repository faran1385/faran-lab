import {v4 as uuidv4} from "uuid";
import type {AttributeWrapper} from "./AttributeWrapper.ts";
import type {IndexAttributeWrapper} from "./IndexWrapper.ts";
import {GeometryHashProvider} from "../hashing/GeometryHashProvider.ts";

export class GeometryWrapper {
    readonly uuid: string;

    private attributes: Map<string, AttributeWrapper> = new Map();
    private indices?: IndexAttributeWrapper;
    readonly hashProvider: GeometryHashProvider;


    constructor() {
        this.uuid = uuidv4();
        this.hashProvider = new GeometryHashProvider({
            getIndices: this.getIndices.bind(this),
            getAttributes: this.getAttributes.bind(this),
        })
    }

    setAttribute(attribute: AttributeWrapper) {
        this.attributes.set(attribute.name, attribute);
        this.hashProvider.sortAttributes(this.attributes)
        this.hashProvider.markChangeStamp()
    }

    removeAttribute(name: string) {
        this.attributes.delete(name)
        this.hashProvider.sortAttributes(this.attributes)
        this.hashProvider.markChangeStamp()
    }

    setIndices(indices: IndexAttributeWrapper) {
        this.indices = indices;
        this.hashProvider.markChangeStamp()
    }

    clearIndices() {
        this.indices = undefined;
        this.hashProvider.markChangeStamp()
    }

    getIndices() {
        return this.indices;
    }

    getAttributes() {
        return this.attributes;
    }

}