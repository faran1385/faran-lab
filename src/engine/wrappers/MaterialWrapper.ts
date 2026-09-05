import type {Material} from "../importers/utils/IR.ts";
import {MaterialComponentWrapper} from "./MaterialComponentWrapper.ts";
import {v4 as uuidv4} from "uuid";
import type {Hasher} from "../hashing/Hasher.ts";
import {
    type MaterialBindingLayout,
} from "../descriptorProducer/MaterialDescriptorProducer.ts";
import {MaterialHashHandler} from "../hashing/MaterialHashHandler.ts";

export class MaterialWrapper {
    private components = new Map<string, MaterialComponentWrapper>();
    private alphaMode: Material["alphaMode"];
    private alphaCutoff?: Material["alphaCutoff"];
    private doubleSided: Material["doubleSided"];
    readonly uuid: string;

    private layoutDescriptor!: MaterialBindingLayout;

    private hashHandler: MaterialHashHandler;

    constructor(
        alphaMode: Material["alphaMode"],
        alphaCutoff: Material["alphaCutoff"],
        doubleSided: Material["doubleSided"],
    ) {
        this.alphaMode = alphaMode;
        this.alphaCutoff = alphaCutoff;
        this.doubleSided = doubleSided;
        this.uuid = uuidv4();

        this.hashHandler = new MaterialHashHandler(
            () => this.components,
        );
    }

    getLayoutDescriptor() {
        return this.layoutDescriptor;
    }

    setLayoutDescriptor(layoutDescriptor: MaterialBindingLayout) {
        this.layoutDescriptor = layoutDescriptor;
    }

    getComponent(name: string): MaterialComponentWrapper | undefined {
        return this.components.get(name);
    }

    setComponent(wrapper: MaterialComponentWrapper): void {
        this.components.set(wrapper.name, wrapper);
        this.hashHandler.bumpComponentVersion()
    }

    getAllComponents(): MaterialComponentWrapper[] {
        return Array.from(this.components.values());
    }

    getAlphaMode(): Material["alphaMode"] { return this.alphaMode; }
    setAlphaMode(alphaMode: Material["alphaMode"]): void { this.alphaMode = alphaMode; }
    getAlphaCutoff(): Material["alphaCutoff"] { return this.alphaCutoff; }
    setAlphaCutoff(alphaCutoff: Material["alphaCutoff"]): void { this.alphaCutoff = alphaCutoff; }
    getDoubleSided(): Material["doubleSided"] { return this.doubleSided; }
    setDoubleSided(doubleSided: Material["doubleSided"]): void { this.doubleSided = doubleSided; }

    getShaderVersionKey(): string {
        return this.hashHandler.getShaderVersionKey();
    }

    getFactorsVersionKey(): string {
        return this.hashHandler.getFactorsVersionKey();
    }

    convertToBindGroupLayoutHash(hasher: Hasher): string {
        return this.hashHandler.convertToBindGroupLayoutHash(hasher);
    }

    convertToBindGroupHash(hasher: Hasher): string {
        return this.hashHandler.convertToBindGroupHash(hasher);
    }

    drainBindGroupLayoutTrash(): string[] {
        return this.hashHandler.drainBindGroupLayoutTrash();
    }

    drainBindGroupTrash(): string[] {
        return this.hashHandler.drainBindGroupTrash();
    }
}