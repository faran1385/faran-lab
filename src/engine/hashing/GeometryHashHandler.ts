import type {AttributeName} from "../importers/utils/IR.ts";
import type {VertexAttributeWrapper} from "../wrappers/VertexAttributeWrapper.ts";
import {AggregateHashHandler} from "./AggregateHashHandler.ts";
import type {IndexAttributeWrapper} from "../wrappers/IndexWrapper.ts";
import type {Hasher} from "./Hasher.ts";

export class GeometryHashHandler {
    private attributesHashHandler: AggregateHashHandler;
    private indicesHashHandler: AggregateHashHandler;
    private structureVersion: number = 0;
    private cachedSortedEntries: [AttributeName, VertexAttributeWrapper][] = [];
    private cachedSortedEntriesStructureVersion: number = -1;
    private readonly getAttributes: () => Map<AttributeName, VertexAttributeWrapper>


    constructor(
        getAttributes: () => Map<AttributeName, VertexAttributeWrapper>,
        getIndices: () => IndexAttributeWrapper | undefined,
    ) {
        this.getAttributes = getAttributes;

        this.attributesHashHandler = new AggregateHashHandler((hasher) =>
            this.sortedEntries()
                .map(([name, attr]) => `${name}:${attr.convertToFormatHash(hasher)}`)
                .join("|")
        );

        this.indicesHashHandler = new AggregateHashHandler((hasher) => {
            const indices = getIndices();
            return indices ? indices.convertToFormatHash(hasher) : "none";
        });
    }

    private sortedEntries(): [AttributeName, VertexAttributeWrapper][] {
        const structureVersion = this.structureVersion;
        if (structureVersion !== this.cachedSortedEntriesStructureVersion) {
            this.cachedSortedEntries = Array.from(this.getAttributes().entries()).sort(([a], [b]) =>
                a.localeCompare(b),
            );
            this.cachedSortedEntriesStructureVersion = structureVersion;
        }
        return this.cachedSortedEntries;
    }

    bumpStructureVersion() {
        this.structureVersion++
    }

    convertToAttributesHash(hasher: Hasher): string {
        return this.attributesHashHandler.convertToHash(hasher);
    }

    convertToIndicesHash(hasher: Hasher): string {
        return this.indicesHashHandler.convertToHash(hasher);
    }

    drainAttributesTrash(): string[] {
        return this.attributesHashHandler.drainTrash();
    }

    drainIndicesTrash(): string[] {
        return this.indicesHashHandler.drainTrash();
    }
}