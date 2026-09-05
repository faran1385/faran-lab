import {v4 as uuidv4} from "uuid";
import type {AttributeName} from "../importers/utils/IR.ts";
import {Hasher} from "../hashing/Hasher.ts";
import type {VertexAttributeWrapper} from "./VertexAttributeWrapper.ts";
import type {IndexAttributeWrapper} from "./IndexWrapper.ts";
import type {VertexAttributeLayout} from "../descriptorProducer/GeometryDescriptorProducer.ts";
import {GeometryHashHandler} from "../hashing/GeometryHashHandler.ts";

export class GeometryWrapper {
    readonly uuid: string;

    private attributes: Map<AttributeName, VertexAttributeWrapper> = new Map();
    private indices?: IndexAttributeWrapper;

    private layoutDescriptor!: Map<string, VertexAttributeLayout>;
    private hashHandler: GeometryHashHandler;

    constructor() {
        this.uuid = uuidv4();
        this.hashHandler = new GeometryHashHandler(
            () => this.attributes,
            () => this.indices,
        );
    }

    setLayoutDescriptor(descriptor: Map<string, VertexAttributeLayout>): void {
        this.layoutDescriptor = descriptor;
    }

    getLayoutDescriptor() {
        return this.layoutDescriptor;
    }

    addAttribute(attribute: VertexAttributeWrapper) {
        this.attributes.set(attribute.name, attribute);
        this.hashHandler.bumpStructureVersion()
    }

    setIndices(indices: IndexAttributeWrapper) {
        this.indices = indices;
        this.hashHandler.bumpStructureVersion()
    }

    getAttributes() {
        return this.attributes;
    }

    convertToAttributesHash(hasher: Hasher): string {
        return this.hashHandler.convertToAttributesHash(hasher);
    }

    convertToIndicesHash(hasher: Hasher): string {
        return this.hashHandler.convertToIndicesHash(hasher);
    }

    drainAttributesTrash(): string[] {
        return this.hashHandler.drainAttributesTrash();
    }

    drainIndicesTrash(): string[] {
        return this.hashHandler.drainIndicesTrash();
    }
}