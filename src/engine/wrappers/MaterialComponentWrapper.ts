import type {TextureWrapper} from "./TextureWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {MaterialComponentHashProvider} from "../hashing/MaterialComponentHashProvider.ts";

export type MaterialComponentTextureSlot = {
    wrapper: TextureWrapper,
    texCoord: string
}

export class MaterialComponentWrapper {
    readonly uuid: string;
    readonly name: string;

    private factors: number[];
    private texture?: MaterialComponentTextureSlot;
    readonly hashProvider: MaterialComponentHashProvider;

    constructor(name: string, factors: number[]) {
        this.uuid = uuidv4();
        this.name = name;
        this.factors = factors;

        this.hashProvider = new MaterialComponentHashProvider({
            getTexture: this.getTexture.bind(this),
        })
    }

    setTexture(texture: MaterialComponentTextureSlot): void {
        this.texture = texture;
        this.hashProvider.markShapeHash();
        this.hashProvider.markShaderHash();
        this.hashProvider.markChangeStamp()
    }

    removeTexture(): void {
        this.texture = undefined;
        this.hashProvider.markShapeHash();
        this.hashProvider.markShaderHash();
        this.hashProvider.markChangeStamp()
    }

    getTexture() {
        return this.texture;
    }

    getFactors() {
        return this.factors;
    }

    setFactors(factors: number[]): void {
        this.factors = factors;
        this.hashProvider.markFactorUpdate();
        this.hashProvider.markChangeStamp()
    }


}