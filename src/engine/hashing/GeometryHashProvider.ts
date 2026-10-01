import type {AttributeWrapper} from "../wrappers/AttributeWrapper.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {Hasher} from "./utils/Hasher.ts";
import {AggregateHashHandler} from "./utils/AggregateHashHandler.ts";
import {HashHandler} from "./utils/HashHandler.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";
import {getEpoch} from "./utils/epoch.ts";
import type {IndexAttributeWrapper} from "../wrappers/IndexWrapper.ts";

type InputFunctions = {
    getIndices: () => IndexAttributeWrapper | undefined,
    getAttributes: () => Map<string, AttributeWrapper>,
}

export class GeometryHashProvider {
    private attributesHash: AggregateHashHandler;
    private attributesShapeHash: HashHandler;
    private sortedAttributes: AttributeWrapper[] = [];
    private readonly changeStamp = new ChangeStamp();
    private memoEpoch = -1;
    private memoChangedAt = 0;
    private wrapperGetFunctions: InputFunctions

    constructor(T: InputFunctions) {
        this.wrapperGetFunctions = T;

        this.attributesHash = new AggregateHashHandler((hasher) =>
            this.sortedAttributes
                .map((wrapper) => `${wrapper.name}:${wrapper.hashProvider.convertToHash(hasher)}`)
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


    /** Latest change stamp of this geometry or of any of its attribute / index buffers. */
    getChangedAt(): number {
        const epoch = getEpoch();
        if (this.memoEpoch === epoch) return this.memoChangedAt;

        let at = this.changeStamp.get();
        for (const attribute of this.wrapperGetFunctions.getAttributes().values()) {
            const attributeAt = attribute.hashProvider.getChangedAt();
            if (attributeAt > at) at = attributeAt;
        }
        const indices=this.wrapperGetFunctions.getIndices()
        if (indices) at = Math.max(at, indices.hashProvider.getChangedAt());

        this.memoEpoch = epoch;
        this.memoChangedAt = at;
        return at;
    }


    markChangeStamp() {
        this.changeStamp.mark()
    }
}