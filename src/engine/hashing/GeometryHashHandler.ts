import type {AttributeWrapper} from "../wrappers/AttributeWrapper.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {Hasher} from "./Hasher.ts";
import {TriggerableAggregateHashHandler} from "./TriggerableAggregateHashHandler.ts";

export class GeometryHashHandler {
    private attributesHash: TriggerableAggregateHashHandler;
    private sortedAttributes: AttributeWrapper[] = [];

    constructor() {
        this.attributesHash = new TriggerableAggregateHashHandler((hasher) =>
            this.sortedAttributes
                .map((wrapper) => `${wrapper.name}:${wrapper.convertToHash(hasher)}`)
                .join("|")
        );
    }

    sortAttributes(attributes: GeometryWrapper["attributes"]): void {
        this.sortedAttributes = Array.from(attributes.values())
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    }

    convertToAttributesHash(hasher: Hasher): string {
        return this.attributesHash.convertToHash(hasher);
    }

    syncAttributesHash(){
        return this.attributesHash.sync()
    }

    needsShaderRebuild(hasher: Hasher){
        return this.attributesHash.needsUpdate(hasher)
    }
}