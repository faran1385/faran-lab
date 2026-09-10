import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {Hasher} from "./Hasher.ts";
import {AggregateHashHandler} from "./AggregateHashHandler.ts";
import type {VertexShaderWrapper} from "../wrappers/VertexShaderWrapper.ts";
import type {FragmentShaderWrapper} from "../wrappers/FragmentShaderWrapper.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";

export class PipelineHashHandler {
    private hashHandler: AggregateHashHandler;
    private currentMaterial!: MaterialWrapper;
    private currentGeometry!: GeometryWrapper;

    private readonly rebuildShaders: (primitive: PrimitiveWrapper) => void

    constructor(
        getVertexShaderWrapper: () => VertexShaderWrapper,
        getFragmentShaderWrapper: () => FragmentShaderWrapper,
        getSettingsKey: () => string,
        rebuildShaders: (primitive: PrimitiveWrapper) => void,
    ) {
        this.rebuildShaders = rebuildShaders;

        this.hashHandler = new AggregateHashHandler((hasher) => {
            const vertexHash = getVertexShaderWrapper().convertToHash(hasher);
            const fragmentHash = getFragmentShaderWrapper().convertToHash(hasher);
            const layoutHash = this.currentMaterial.convertToBindGroupLayoutHash(hasher);
            const attributeHash = this.currentGeometry.convertToAttributesHash(hasher);
            const settingsKey = getSettingsKey();
            return `${vertexHash}|${fragmentHash}|${layoutHash}|${attributeHash}|${settingsKey}`;
        });
    }

    private checkShaderRebuild(primitive: PrimitiveWrapper): void {
        if (primitive.getMaterial().needsShaderRebuild()) {
            this.rebuildShaders(primitive);
        }
    }

    computeHash(primitive: PrimitiveWrapper, hasher: Hasher): string {
        this.currentMaterial = primitive.getMaterial();
        this.currentGeometry = primitive.getGeometry();
        this.checkShaderRebuild(primitive);
        return this.hashHandler.convertToHash(hasher);
    }

    drainTrash(): string[] {
        return this.hashHandler.drainTrash();
    }
}