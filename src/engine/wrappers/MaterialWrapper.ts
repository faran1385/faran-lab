import type {Material} from "../importers/utils/IR.ts";
import {MaterialComponentWrapper} from "./MaterialComponentWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {MaterialAdaptor} from "../Adaptors/MaterialAdaptor.ts";

type MaterialArgs = {
    alphaMode?: Material["alphaMode"],
    alphaCutoff?: Material["alphaCutoff"],
    doubleSided?: Material["doubleSided"],
}

export class MaterialWrapper {
    readonly uuid: string;
    readonly adaptor = new MaterialAdaptor(this);

    private components = new Map<string, MaterialComponentWrapper>();
    private sortedComponents: MaterialComponentWrapper[] = [];

    private alphaMode: Material["alphaMode"];
    private alphaCutoff = 0;
    private doubleSided: Material["doubleSided"];



    constructor(args: MaterialArgs = {}) {
        this.uuid = uuidv4();
        this.alphaMode = args?.alphaMode ?? "opaque";
        this.alphaCutoff = args?.alphaCutoff ?? 0;
        this.doubleSided = args?.doubleSided ?? false;

    }

    private sortComponents(): void {
        this.sortedComponents = Array.from(this.components.values())
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    }

    getSortedComponents(): MaterialComponentWrapper[] {
        return this.sortedComponents;
    }


    getComponent(name: string): MaterialComponentWrapper | undefined {
        return this.components.get(name);
    }

    setComponent(wrapper: MaterialComponentWrapper): void {
        const replaced = this.components.get(wrapper.name);
        if (replaced && replaced !== wrapper) this.adaptor.removeMaterialComponent(replaced);
        this.components.set(wrapper.name, wrapper);
        this.sortComponents();
        this.adaptor.setMaterialComponent(wrapper);
    }

    removeComponent(name: string): void {
        const removed = this.components.get(name);
        this.components.delete(name);
        this.sortComponents();
        if (removed) this.adaptor.removeMaterialComponent(removed);
    }

    getAlphaMode(): Material["alphaMode"] {
        return this.alphaMode;
    }

    setAlphaMode(alphaMode: Material["alphaMode"]): void {
        this.alphaMode = alphaMode;
        this.adaptor.invalidateSettings();
    }

    getAlphaCutoff() {
        return this.alphaCutoff;
    }

    setAlphaCutoff(alphaCutoff: number): void {
        this.alphaCutoff = alphaCutoff;
        this.adaptor.invalidateFactors();
    }

    getDoubleSided(): Material["doubleSided"] {
        return this.doubleSided;
    }

    setDoubleSided(doubleSided: Material["doubleSided"]): void {
        this.doubleSided = doubleSided;
        this.adaptor.invalidateSettings();
    }


}