import type {AttributeWrapper} from "./AttributeWrapper.ts";
import {v4 as uuidv4} from "uuid";

type BoundingBox = {
    min: [number, number, number],
    max: [number, number, number],
}

type Indices = { format: "uint16" | "uint32", data: ArrayBuffer }

export class GeometryWrapper {
    readonly uuid: string;

    private attributes: Map<string, AttributeWrapper> = new Map();
    private boundingBox?: BoundingBox;
    private indices?: Indices;

    constructor(indices?: Indices, boundingBox?: BoundingBox) {
        this.indices = indices;
        this.boundingBox = boundingBox;
        this.uuid = uuidv4();
    }

    addAttribute(attribute: AttributeWrapper) {
        this.attributes.set(attribute.uuid, attribute);
    }

    setIndices(indices: Indices) {
        this.indices = indices;
    }

    setBoundingBox(bounding: BoundingBox | undefined) {
        this.boundingBox = bounding;
    }
}