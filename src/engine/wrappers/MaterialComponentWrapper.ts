import type {TextureWrapper} from "./TextureWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {MaterialComponentAdaptor} from "../Adaptors/MaterialComponentAdaptor.ts";

export type MaterialComponentTextureSlot = {
    wrapper: TextureWrapper,
    texCoord: string
}

export class MaterialComponentWrapper {
    readonly uuid: string;
    readonly name: string;
    readonly adaptor: MaterialComponentAdaptor;

    private factors: number[];
    private texture?: MaterialComponentTextureSlot;

    constructor(name: string, factors: number[]) {
        this.uuid = uuidv4();
        this.name = name;
        this.factors = factors;
        this.adaptor = new MaterialComponentAdaptor();
    }

    setTexture(texture: MaterialComponentTextureSlot): void {
        if (this.texture === texture) return;
        this.texture?.wrapper.adaptor.disconnectAdaptor(this.uuid)

        this.texture = texture;
        texture.wrapper.adaptor.connectAdaptor(this.uuid, this.adaptor.onTextureChange)
        this.adaptor.onStructureChange()
    }

    removeTexture(): void {
        this.texture?.wrapper.adaptor.disconnectAdaptor(this.uuid)
        this.texture = undefined;
        this.adaptor.onStructureChange()
    }

    getTexture() {
        return this.texture;
    }

    getFactors() {
        return this.factors;
    }

    setFactors(factors: number[]): void {
        this.factors = factors;
        this.adaptor.onFactorsChange()
    }


}