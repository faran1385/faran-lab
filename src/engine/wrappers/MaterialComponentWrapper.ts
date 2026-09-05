import type {TextureWrapper} from "./TextureWrapper.ts";
import {v4 as uuidv4} from "uuid";
import type {Hasher} from "../hashing/Hasher.ts";
import {MaterialComponentHashHandler} from "../hashing/MaterialComponentHashHandler.ts";

export type MaterialComponentTextureSlot = {
    wrapper: TextureWrapper,
    texCoord: `uv${number}`
}
export class MaterialComponentWrapper {
    private factors: number[];
    readonly uuid: string;
    readonly name: string;
    private texture?: MaterialComponentTextureSlot;

    private hashHandler: MaterialComponentHashHandler;

    constructor(name: string, factors: number[]) {
        this.factors = factors;
        this.name = name;
        this.uuid = uuidv4();

        this.hashHandler = new MaterialComponentHashHandler(name, () => this.texture);
    }

    setTexture(texture: MaterialComponentTextureSlot): void {
        this.texture = texture;
        this.hashHandler.bumpShaderVersion()
    }

    getTexture() {
        return this.texture;
    }

    getFactors() {
        return this.factors;
    }

    setFactors(factors: number[]): void {
        this.factors = factors;
        this.hashHandler.bumpFactorsBufferVersion()
    }

    getShaderVersion(): number {
        return this.hashHandler.getShaderVersion()
    }

    getFactorsBufferVersion(): number {
        return this.hashHandler.getFactorsBufferVersion();
    }

    getBindGroupLayoutHashPart(): string {
        return this.hashHandler.getBindGroupLayoutHashPart();
    }

    getBindGroupHashPart(hasher: Hasher): string {
        return this.hashHandler.getBindGroupHashPart(hasher);
    }
}