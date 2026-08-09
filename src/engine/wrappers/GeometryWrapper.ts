import {v4 as uuidv4} from "uuid";
import type {AttributeName} from "../importers/utils/IR.ts";
import {Hasher} from "../hashing/Hasher.ts";
import type {VertexAttributeWrapper} from "./VertexAttributeWrapper.ts";
import type {IndexAttributeWrapper} from "./IndexWrapper.ts";

export class GeometryWrapper {
    readonly uuid: string;

    private attributes: Map<AttributeName, VertexAttributeWrapper> = new Map();
    private indices?: IndexAttributeWrapper;

    private cachedHash: string | null = null;
    private cachedAttributeVersions: Map<AttributeName, number> = new Map();
    private cachedIndicesVersion: number | null = null;
    private hadIndicesLastHash: boolean = false;

    constructor() {
        this.uuid = uuidv4();
    }

    addAttribute(attribute: VertexAttributeWrapper) {
        this.attributes.set(attribute.name, attribute);
    }

    setIndices(indices: IndexAttributeWrapper) {
        this.indices = indices;
    }

    convertToHash(hasher: Hasher): string {
        if (this.isCacheValid()) {
            return this.cachedHash!;
        }

        const attrPart = Array.from(this.attributes.entries())
            .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
            .map(([name, attr]) => `${name}:${attr.convertToHash(hasher)}`)
            .join('|');

        const indexPart = this.indices ? this.indices.convertToHash(hasher) : '';

        this.cachedHash = hasher.hashString(`${attrPart}#${indexPart}`);

        this.cachedAttributeVersions = new Map(
            Array.from(this.attributes.entries()).map(([name, attr]) => [name, attr.getVersion()])
        );
        this.cachedIndicesVersion = this.indices ? this.indices.getVersion() : null;
        this.hadIndicesLastHash = this.indices !== undefined;

        return this.cachedHash;
    }

    private isCacheValid(): boolean {
        if (this.cachedHash === null) return false;

        const hasIndicesNow = this.indices !== undefined;
        if (hasIndicesNow !== this.hadIndicesLastHash) return false;
        if (hasIndicesNow && this.indices!.getVersion() !== this.cachedIndicesVersion) return false;

        if (this.cachedAttributeVersions.size !== this.attributes.size) return false;
        for (const [name, attr] of this.attributes) {
            if (this.cachedAttributeVersions.get(name) !== attr.getVersion()) {
                return false;
            }
        }
        return true;
    }
}