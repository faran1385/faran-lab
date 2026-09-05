import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {Hasher} from "./Hasher.ts";
import {AggregateHashHandler} from "./AggregateHashHandler.ts";
import type {VertexShaderWrapper} from "../wrappers/VertexShaderWrapper.ts";
import type {FragmentShaderWrapper} from "../wrappers/FragmentShaderWrapper.ts";

export class PipelineHashHandler {
    private hashHandler: AggregateHashHandler;
    private currentMaterial!: MaterialWrapper;
    private currentGeometry!: GeometryWrapper;

    constructor(
        getVertexShaderWrapper: () => VertexShaderWrapper,
        getFragmentShaderWrapper: () => FragmentShaderWrapper,
        getSettingsKey: () => string,
    ) {
        this.hashHandler = new AggregateHashHandler((hasher) => {
            const vertexHash = getVertexShaderWrapper().convertToHash(hasher);
            const fragmentHash = getFragmentShaderWrapper().convertToHash(hasher);
            const layoutHash = this.currentMaterial.convertToBindGroupLayoutHash(hasher);
            const attributeHash = this.currentGeometry.convertToAttributesHash(hasher);
            const settingsKey = getSettingsKey();
            return `${vertexHash}|${fragmentHash}|${layoutHash}|${attributeHash}|${settingsKey}`;
        });
    }

    computeHash(material: MaterialWrapper, geometry: GeometryWrapper, hasher: Hasher): string {
        this.currentMaterial = material;
        this.currentGeometry = geometry;
        return this.hashHandler.convertToHash(hasher);
    }

    drainTrash(): string[] {
        return this.hashHandler.drainTrash();
    }
}