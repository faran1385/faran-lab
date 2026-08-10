import type {Material} from "../importers/utils/IR.ts";
import {MaterialComponentWrapper} from "./MaterialComponentWrapper.ts";
import {v4 as uuidv4} from "uuid";
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


    convertToShaderHash(hasher: Hasher): string {
        const parts = this.sortedComponents()
            .map((c) => {
                const factorType = c.getFactors().length;
                const texture = c.getTexture();
                const hasTexture = texture ? "1" : "0";
                const texCoord = texture ? texture.texCoord : "none";
                return `${c.name}|${factorType}|${hasTexture}|${texCoord}`;
            })
            .join(",");

        return hasher.hashString(parts);
    }

    convertToFactorsBufferHash(hasher: Hasher): string {
        const parts = this.sortedComponents()
            .map((c) => `${c.name}|${c.getFactors().length}`)
            .join(",");

        return hasher.hashString(parts);
    }

    convertToBindGroupLayoutHash(hasher: Hasher): string {
        const hasAnyFactors = this.sortedComponents().some((c) => c.getFactors().length > 0)
            ? "1"
            : "0";

        const texturePart = this.sortedComponents()
            .map((c) => `${c.name}|${c.getTexture() ? "1" : "0"}`)
            .join(",");

        return hasher.hashString(`factors:${hasAnyFactors}|textures:${texturePart}`);
    }

    convertToBindGroupHash(hasher: Hasher): string {
        const layoutPart = this.convertToBindGroupLayoutHash(hasher);
        const bufferPart = this.convertToFactorsBufferHash(hasher);

        const texturePart = this.sortedComponents()
            .map((c) => {
                const texture = c.getTexture();
                return `${c.name}|${texture ? texture.wrapper.convertToHash(hasher) : "none"}`;
            })
            .join(",");

        return hasher.hashString(`${layoutPart}|${bufferPart}|${texturePart}`);
    }

    private sortedComponents(): MaterialComponentWrapper[] {
        return Array.from(this.components.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    convertToHash(hasher: Hasher): string {
        return hasher.hashString(
            `${this.convertToBindGroupLayoutHash(hasher)}|${this.convertToShaderHash(hasher)}|${this.alphaMode}|${this.alphaCutoff ?? "none"}|${this.doubleSided}`
        );
    }
}