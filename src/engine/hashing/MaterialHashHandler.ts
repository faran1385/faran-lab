import type {MaterialComponentWrapper} from "../wrappers/MaterialComponentWrapper.ts";
import {AggregateHashHandler} from "./AggregateHashHandler.ts";
import type {Hasher} from "./Hasher.ts";

export class MaterialHashHandler {
    private bindGroupLayoutHashHandler: AggregateHashHandler;
    private bindGroupHashHandler: AggregateHashHandler;

    private cachedSortedComponents: MaterialComponentWrapper[] = [];
    private lastSortedComponentsVersion: number = -1;
    private readonly getComponents: () => Map<string, MaterialComponentWrapper>
    private componentsVersion: number = 0;

    constructor(
        getComponents: () => Map<string, MaterialComponentWrapper>,
    ) {
        this.getComponents = getComponents;

        this.bindGroupLayoutHashHandler = new AggregateHashHandler(() => {
            const components = this.sortedComponents();
            const hasAnyFactors = components.some((c) => c.getFactors().length > 0) ? "1" : "0";
            const texturePart = components.map((c) => c.getBindGroupLayoutHashPart()).join(",");
            return `factors:${hasAnyFactors}|textures:${texturePart}`;
        });

        this.bindGroupHashHandler = new AggregateHashHandler((hasher) => {
            const components = this.sortedComponents();
            const layoutPart = this.bindGroupLayoutHashHandler.convertToHash(hasher);
            const shapePart = components.map((c) => c.getFactors().length).join(",");
            const texturePart = components.map((c) => c.getBindGroupHashPart(hasher)).join(",");
            return `${layoutPart}|${shapePart}|${texturePart}`;
        });
    }

    private sortedComponents(): MaterialComponentWrapper[] {
        const version = this.componentsVersion;
        if (version !== this.lastSortedComponentsVersion) {
            this.cachedSortedComponents = Array.from(this.getComponents().values()).sort((a, b) =>
                a.name.localeCompare(b.name),
            );
            this.lastSortedComponentsVersion = version;
        }
        return this.cachedSortedComponents;
    }

    bumpComponentVersion() {
        this.componentsVersion++
    }

    getShaderVersionKey(): string {
        return (
            `${this.componentsVersion}:` +
            this.sortedComponents().map((c) => c.getShaderVersion()).join(",")
        );
    }

    getFactorsVersionKey(): string {
        return (
            `${this.componentsVersion}:` +
            this.sortedComponents().map((c) => c.getFactorsBufferVersion()).join(",")
        );
    }

    convertToBindGroupLayoutHash(hasher: Hasher): string {
        return this.bindGroupLayoutHashHandler.convertToHash(hasher);
    }

    convertToBindGroupHash(hasher: Hasher): string {
        return this.bindGroupHashHandler.convertToHash(hasher);
    }

    drainBindGroupLayoutTrash(): string[] {
        return this.bindGroupLayoutHashHandler.drainTrash();
    }

    drainBindGroupTrash(): string[] {
        return this.bindGroupHashHandler.drainTrash();
    }
}