import type {TextureWrapper} from "./TextureWrapper.ts";
import {v4 as uuidv4} from "uuid";
import type {Hasher} from "../hashing/Hasher.ts";

type MaterialComponentTextureSlot = {
    wrapper: TextureWrapper,
    texCoord: `uv${number}`
}

export class MaterialComponentWrapper {
    private factors: number[];
    readonly uuid: string;
    readonly name: string
    private texture?: MaterialComponentTextureSlot
    private version = 0;
    private lastSyncedVersion = 0;

    constructor(name: string, factors: number[]) {
        this.factors = factors;
        this.name = name;

        this.uuid = uuidv4();
    }


    setTexture(texture: MaterialComponentTextureSlot): void {
        this.texture = texture;
    }

    getTexture() {
        return this.texture;
    }

    getFactors() {
        return this.factors
    }

    convertToShaderHash(hasher: Hasher): string {
        const factorType = this.factors.length;
        const hasTexture = this.texture ? "1" : "0";
        const texCoord = this.texture ? this.texture.texCoord : "none";

        return hasher.hashString(`${this.name}|${factorType}|${hasTexture}|${texCoord}`);
    }

    convertToBindGroupLayoutHash(hasher: Hasher): string {
        const hasTexture = this.texture ? "1" : "0";

        return hasher.hashString(`${this.name}|${hasTexture}`);
    }

    convertToBindGroupHash(hasher: Hasher): string {
        const layoutPart = this.convertToBindGroupLayoutHash(hasher);
        const texturePart = this.texture ? this.texture.wrapper.convertToHash(hasher) : "none";

        return hasher.hashString(`${layoutPart}|${texturePart}`);
    }



    setFactors(factors: number[]): void {
        this.factors = factors;
        this.version++;
    }

    getVersion(): number {
        return this.version;
    }

    isDirty(): boolean {
        return this.version !== this.lastSyncedVersion;
    }

    markSynced(): void {
        this.lastSyncedVersion = this.version;
    }

    convertToBufferContentHash(hasher: Hasher): string {
        const factorsPart = this.factors.join(",");
        return hasher.hashString(`${this.name}|${factorsPart}`);
    }
}