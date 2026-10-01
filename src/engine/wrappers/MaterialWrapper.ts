import type {Material} from "../importers/utils/IR.ts";
import {MaterialComponentWrapper} from "./MaterialComponentWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {MaterialHashProvider} from "../hashing/MaterialHashProvider.ts";

type MaterialArgs = {
    alphaMode?: Material["alphaMode"],
    alphaCutoff?: Material["alphaCutoff"],
    doubleSided?: Material["doubleSided"],
}

export class MaterialWrapper {
    readonly uuid: string;

    private components = new Map<string, MaterialComponentWrapper>();
    private sortedComponents: MaterialComponentWrapper[] = [];

    private alphaMode: Material["alphaMode"];
    private alphaCutoff = 0;
    private doubleSided: Material["doubleSided"];

    readonly hashProvider: MaterialHashProvider;


    constructor(args: MaterialArgs = {}) {
        this.uuid = uuidv4();
        this.alphaMode = args?.alphaMode ?? "opaque";
        this.alphaCutoff = args?.alphaCutoff ?? 0;
        this.doubleSided = args?.doubleSided ?? false;

        this.hashProvider = new MaterialHashProvider(this.uuid, {
            getDoubleSided: this.getDoubleSided.bind(this),
            getAlphaMode: this.getAlphaMode.bind(this),
            getSortedComponents: () => this.sortedComponents,
        })
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
        this.components.set(wrapper.name, wrapper);
        this.sortComponents();
        this.hashProvider.markChangeStamp()
    }

    removeComponent(name: string): void {
        this.components.delete(name);
        this.sortComponents();
        this.hashProvider.markChangeStamp()
    }

    getAllComponents(): MaterialComponentWrapper[] {
        return Array.from(this.components.values());
    }

    getAlphaMode(): Material["alphaMode"] {
        return this.alphaMode;
    }

    setAlphaMode(alphaMode: Material["alphaMode"]): void {
        this.alphaMode = alphaMode;
        this.hashProvider.markPipelineSettingsHash()
        this.hashProvider.markChangeStamp()
    }

    getAlphaCutoff() {
        return this.alphaCutoff;
    }

    setAlphaCutoff(alphaCutoff: number): void {
        this.alphaCutoff = alphaCutoff;
    }

    getDoubleSided(): Material["doubleSided"] {
        return this.doubleSided;
    }

    setDoubleSided(doubleSided: Material["doubleSided"]): void {
        this.doubleSided = doubleSided;
        this.hashProvider.markPipelineSettingsHash()
        this.hashProvider.markChangeStamp()
    }


}