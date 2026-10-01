import type {AttributeWrapper} from "../wrappers/AttributeWrapper.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {Hasher} from "./Hasher.ts";
import {AggregateHashHandler} from "./AggregateHashHandler.ts";
import {HashHandler} from "./HashHandler.ts";

export class GeometryHashHandler {
    private attributesHash: AggregateHashHandler;
    private attributesShapeHash: HashHandler;
    private sortedAttributes: AttributeWrapper[] = [];

    constructor() {
        this.attributesHash = new AggregateHashHandler((hasher) =>
            this.sortedAttributes
                .map((wrapper) => `${wrapper.name}:${wrapper.convertToHash(hasher)}`)
                .join("|")
        );

        this.attributesShapeHash = new HashHandler(() =>
            this.sortedAttributes
                .map((a) => `${a.name}:${a.format}`)
                .join("|")
        );
    }

    sortAttributes(attributes: GeometryWrapper["attributes"]): void {
        this.sortedAttributes = Array.from(attributes.values())
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        // The shape hash is version-gated, and the set of attributes is exactly what it describes. Without this bump
        // adding or removing an attribute left the cached shape hash (and so the pipeline's vertex layout) stale.
        this.attributesShapeHash.addVersion();
    }

    convertToAttributesHash(hasher: Hasher): string {
        return this.attributesHash.convertToHash(hasher);
    }

    convertToAttributesShapeHash(hasher: Hasher): string {
        return this.attributesShapeHash.convertToHash(hasher);
    }
}