import type {Material} from "../importers/utils/IR.ts";
import {v4 as uuidv4} from "uuid";

export class MaterialWrapper {
    private components: Material["components"];
    private alphaMode: Material["alphaMode"];
    private alphaCutoff?: Material["alphaCutoff"];
    private doubleSided: Material["doubleSided"];
    readonly uuid: string;

    constructor(
        components: Material["components"],
        alphaMode: Material["alphaMode"],
        alphaCutoff: Material["alphaCutoff"],
        doubleSided: Material["doubleSided"],
    ) {
        this.components = components;
        this.alphaMode = alphaMode;
        this.alphaCutoff = alphaCutoff;
        this.doubleSided = doubleSided;

        this.uuid = uuidv4();
    }
}