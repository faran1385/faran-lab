import type {Material} from "../importers/utils/IR.ts";
import {MaterialComponentWrapper} from "./MaterialComponentWrapper.ts";
import { v4 as uuidv4 } from "uuid";
import type {Hasher} from "../hashing/Hasher.ts";

export class MaterialWrapper {
    private components = new Map<string, MaterialComponentWrapper>();
    private alphaMode: Material["alphaMode"];
    private alphaCutoff?: Material["alphaCutoff"];
    private doubleSided: Material["doubleSided"];
    readonly uuid: string;

    constructor(
        alphaMode: Material["alphaMode"],
        alphaCutoff: Material["alphaCutoff"],
        doubleSided: Material["doubleSided"],
    ) {
        this.alphaMode = alphaMode;
        this.alphaCutoff = alphaCutoff;
        this.doubleSided = doubleSided;

        this.uuid = uuidv4();
    }

    getComponent(name: string): MaterialComponentWrapper | undefined {
        return this.components.get(name);
    }

    setComponent(wrapper: MaterialComponentWrapper): void {
        this.components.set(wrapper.name, wrapper);
    }

    getAllComponents(): MaterialComponentWrapper[] {
        return Array.from(this.components.values());
    }

    getAlphaMode(): Material["alphaMode"] {
        return this.alphaMode;
    }

    setAlphaMode(alphaMode: Material["alphaMode"]): void {
        this.alphaMode = alphaMode;
    }

    getAlphaCutoff(): Material["alphaCutoff"] {
        return this.alphaCutoff;
    }

    setAlphaCutoff(alphaCutoff: Material["alphaCutoff"]): void {
        this.alphaCutoff = alphaCutoff;
    }

    getDoubleSided(): Material["doubleSided"] {
        return this.doubleSided;
    }

    setDoubleSided(doubleSided: Material["doubleSided"]): void {
        this.doubleSided = doubleSided;
    }

    convertToHash(hasher: Hasher): string {
        const componentsPart = Array.from(this.components.keys())
            .sort()
            .map((name) => `${name}:${this.components.get(name)!.convertToHash(hasher)}`)
            .join(",");

        return hasher.hashString(
            `${componentsPart}|${this.alphaMode}|${this.alphaCutoff ?? "none"}|${this.doubleSided}`
        );
    }
}