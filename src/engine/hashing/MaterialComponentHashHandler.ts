import type {MaterialComponentTextureSlot} from "../wrappers/MaterialComponentWrapper.ts";
import type {Hasher} from "./Hasher.ts";

export class MaterialComponentHashHandler {
    private lastLayoutKey: string | null = null;
    private cachedLayoutPart: string = "";

    private lastBindGroupKey: string | null = null;
    private cachedBindGroupPart: string = "";
    private readonly name: string
    private readonly getTexture: () => MaterialComponentTextureSlot | undefined
    private shaderVersion: number = 0;
    private factorsBufferVersion: number = 0;

    constructor(
        name: string,
        getTexture: () => MaterialComponentTextureSlot | undefined,
    ) {
        this.name = name;
        this.getTexture = getTexture;
    }

    getShaderVersion(): number {
        return this.shaderVersion;
    }

    getFactorsBufferVersion(): number {
        return this.factorsBufferVersion;
    }

    bumpShaderVersion() {
        this.shaderVersion++
    }

    bumpFactorsBufferVersion() {
        this.factorsBufferVersion++
    }

    getBindGroupLayoutHashPart(): string {
        const hasTexture = this.getTexture() ? "1" : "0";
        const key = `${this.name}|${hasTexture}`;

        if (key !== this.lastLayoutKey) {
            this.cachedLayoutPart = key;
            this.lastLayoutKey = key;
        }
        return this.cachedLayoutPart;
    }

    getBindGroupHashPart(hasher: Hasher): string {
        const texture = this.getTexture();
        const currentTextureHash = texture ? texture.wrapper.convertToHash(hasher) : "none";
        const key = `${this.name}|${currentTextureHash}`;

        if (key !== this.lastBindGroupKey) {
            this.cachedBindGroupPart = key;
            this.lastBindGroupKey = key;
        }
        return this.cachedBindGroupPart;
    }
}