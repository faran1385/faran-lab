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

    constructor(name: string, factors: number[]) {
        this.factors = factors;
        this.name = name;

        this.uuid = uuidv4();
    }


    setTexture(texture: MaterialComponentTextureSlot): void {
        this.texture = texture;
    }

    setFactors(factors: number[]): void {
        this.factors = factors;
    }

    getTexture() {
        return this.texture;
    }

    getFactors() {
        return this.factors
    }

    convertToHash(hasher: Hasher): string {
        const factorsPart = this.factors.join(",");
        const texturePart = this.texture
            ? `${this.texture.wrapper.convertToHash(hasher)}|${this.texture.texCoord}`
            : "none";

        return hasher.hashString(`${this.name}|${factorsPart}|${texturePart}`);
    }
}