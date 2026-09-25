import type {TextureWrapper} from "./TextureWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {MaterialComponentHashHandler} from "../hashing/MaterialComponentHashHandler.ts";
import type {Hasher} from "../hashing/Hasher.ts";
import {HashHandler} from "../hashing/HashHandler.ts";
import {AggregateHashHandler} from "../hashing/AggregateHashHandler.ts";

export type MaterialComponentTextureSlot = {
    wrapper: TextureWrapper,
    texCoord: string
}

export class MaterialComponentWrapper {
    readonly uuid: string;
    readonly name: string;

    private factors: number[];
    private texture?: MaterialComponentTextureSlot;
    private hashHandler: MaterialComponentHashHandler;

    constructor(name: string, factors: number[]) {
        this.uuid = uuidv4();
        this.name = name;
        this.factors = factors;

        this.hashHandler = new MaterialComponentHashHandler(
            new HashHandler(() => (this.texture ? "1" : "0")),
            new HashHandler(() => (this.texture ? this.texture.texCoord : "0")),
            new AggregateHashHandler((hasher) =>
                this.texture ? this.texture.wrapper.convertToHash(hasher) : "notex"
            ),
        )
    }

    setTexture(texture: MaterialComponentTextureSlot): void {
        this.texture = texture;
        this.hashHandler.shapeHash.addVersion();
        this.hashHandler.shaderKeyHash.addVersion();
    }

    removeTexture(): void {
        this.texture = undefined;
        this.hashHandler.shapeHash.addVersion();
        this.hashHandler.shaderKeyHash.addVersion();
    }

    getTexture() {
        return this.texture;
    }

    getFactors() {
        return this.factors;
    }

    setFactors(factors: number[]): void {
        this.factors = factors;
        this.hashHandler.factorVersionFlag.addVersion()
    }

    convertToShapeHash(hasher: Hasher): string {
        return this.hashHandler.shapeHash.convertToHash(hasher);
    }

    convertToShaderKeyHash(hasher: Hasher): string {
        return this.hashHandler.shaderKeyHash.convertToHash(hasher);
    }

    convertToResourceHash(hasher: Hasher): string {
        return this.hashHandler.resourceHash.convertToHash(hasher);
    }

    needsFactorUpdate() {
        return this.hashHandler.factorVersionFlag.needsUpdate()
    }

    syncFactorUpdate() {
        this.hashHandler.factorVersionFlag.sync()
    }
}