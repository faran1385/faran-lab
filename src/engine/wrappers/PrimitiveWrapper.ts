import type {GeometryWrapper} from "./GeometryWrapper.ts";
import type {MaterialWrapper} from "./MaterialWrapper.ts";
import type {Primitive} from "../importers/utils/IR.ts";
import {v4 as uuidv4} from "uuid";

export class PrimitiveWrapper {
    readonly uuid: string;

    private geometry: GeometryWrapper;
    private material: MaterialWrapper;
    private topology: Primitive["topology"]

    constructor(topology: Primitive["topology"]) {
        this.topology = topology;
        this.uuid = uuidv4();
    }


    setTopology(topology: Primitive["topology"]) {
        this.topology = topology;
    }


    setGeometry(geometry: GeometryWrapper) {
        this.geometry = geometry;
    }

    setMaterial(material: MaterialWrapper) {
        this.material = material;
    }
}