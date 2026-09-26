import type {Material} from "../importers/utils/IR.ts";
import {MaterialComponentWrapper} from "./MaterialComponentWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {HashHandler} from "../hashing/HashHandler.ts";
import {AggregateHashHandler} from "../hashing/AggregateHashHandler.ts";
import type {Hasher} from "../hashing/Hasher.ts";
import {MaterialHashHandler} from "../hashing/MaterialHashHandler.ts";
import {TriggerableAggregateHashHandler} from "../hashing/TriggerableAggregateHashHandler.ts";
import {planMaterialBindings} from "../producers/utils.ts";

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

    private hashHandler: MaterialHashHandler;

    constructor(args: MaterialArgs={}) {
        this.uuid = uuidv4();
        this.alphaMode = args?.alphaMode ?? "opaque";
        this.alphaCutoff = args?.alphaCutoff ?? 0;
        this.doubleSided = args?.doubleSided ?? false;

        this.hashHandler = new MaterialHashHandler(
            new HashHandler(() => `${this.alphaMode}|${this.doubleSided}`),
            new AggregateHashHandler(() => {
                let i = 1;
                this.sortedComponents.forEach((c) => {
                    i += c.getFactors().length;
                })
                return `${this.uuid}${i}`
            }),
            new TriggerableAggregateHashHandler((hasher) =>
                `${this.alphaMode}|` + this.sortedComponents
                    .map((c) => `${c.name}:${c.convertToShaderKeyHash(hasher)}`)
                    .join("|")
            ),
            new AggregateHashHandler((hasher) =>
                this.sortedComponents
                    .map((c) => `${c.name}:${c.convertToShapeHash(hasher)}`)
                    .join("|")
                + "#" + planMaterialBindings(this.sortedComponents).signature
            ),
            new AggregateHashHandler((hasher) =>
                `${this.hashHandler.factorsHash.convertToHash(hasher)}` + this.sortedComponents
                    .map((c) => `${c.name}:${c.convertToResourceHash(hasher)}`)
                    .join("|")
            )
        )
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
    }

    removeComponent(name: string): void {
        this.components.delete(name);
        this.sortComponents();
    }

    getAllComponents(): MaterialComponentWrapper[] {
        return Array.from(this.components.values());
    }

    getAlphaMode(): Material["alphaMode"] {
        return this.alphaMode;
    }

    setAlphaMode(alphaMode: Material["alphaMode"]): void {
        this.alphaMode = alphaMode;
        this.hashHandler.pipelineSettingsHash.addVersion();
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
        this.hashHandler.pipelineSettingsHash.addVersion();
    }

    convertToPipelineSettingsHash(hasher: Hasher): string {
        return this.hashHandler.pipelineSettingsHash.convertToHash(hasher);
    }

    convertToShaderHash(hasher: Hasher): string {
        return this.hashHandler.shaderHash.convertToHash(hasher);
    }

    convertToBindgroupLayoutHash(hasher: Hasher): string {
        return this.hashHandler.bindgroupLayoutHash.convertToHash(hasher);
    }

    convertToBindgroupHash(hasher: Hasher): string {
        return this.hashHandler.bindgroupHash.convertToHash(hasher);
    }

    convertToFactorsHash(hasher: Hasher): string {
        return this.hashHandler.factorsHash.convertToHash(hasher);
    }

    needsShaderRebuild(hasher: Hasher) {
        return this.hashHandler.shaderHash.needsUpdate(hasher)
    }

    syncShaderRebuild() {
        this.hashHandler.shaderHash.sync()
    }
}