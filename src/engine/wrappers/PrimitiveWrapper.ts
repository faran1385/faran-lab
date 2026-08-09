import type {GeometryWrapper} from "./GeometryWrapper.ts";
import type {MaterialWrapper} from "./MaterialWrapper.ts";
import type {Primitive} from "../importers/utils/IR.ts";
import {v4 as uuidv4} from "uuid";
import type {Hasher} from "../hashing/Hasher.ts";

export class PrimitiveWrapper {
    readonly uuid: string;

    private geometry!: GeometryWrapper;
    private material!: MaterialWrapper;
    private topology: Primitive["topology"];

    constructor(topology: Primitive["topology"]) {
        this.topology = topology;
        this.uuid = uuidv4();
    }

    getTopology(): Primitive["topology"] {
        return this.topology;
    }

    setTopology(topology: Primitive["topology"]): void {
        this.topology = topology;
    }

    getGeometry(): GeometryWrapper {
        return this.geometry;
    }

    setGeometry(geometry: GeometryWrapper): void {
        this.geometry = geometry;
    }

    getMaterial(): MaterialWrapper {
        return this.material;
    }

    setMaterial(material: MaterialWrapper): void {
        this.material = material;
    }

    convertToHash(hasher: Hasher): string {
        const geometryHash = this.geometry.convertToHash(hasher);
        const materialHash = this.material.convertToHash(hasher);

        return hasher.hashString(`${geometryHash}|${materialHash}|${this.topology}`);
    }
}