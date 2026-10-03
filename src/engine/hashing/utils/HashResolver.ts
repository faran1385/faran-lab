import type {Hasher} from "./Hasher.ts";
import type {MaterialWrapper} from "../../wrappers/MaterialWrapper.ts";
import type {GeometryWrapper} from "../../wrappers/GeometryWrapper.ts";
import type {PipelineWrapper} from "../../wrappers/PipelineWrapper.ts";
import type {MaterialBindingPlan} from "../../producers/BindGroupLayoutProducer.ts";
import type {GeometryHashes, MaterialHashes, MaterialTextureHashes, PipelineHashes, Resolved} from "./HashData.ts";
import type {ImageWrapper} from "../../wrappers/ImageWrapper.ts";

interface CacheEntry<T> {
    /** The wrapper's getChangedAt() when these hashes were computed. */
    builtAt: number;
    hashes: T;
}

/**
 * The hash layer. Turns wrappers into HashData and nothing else: no GPU resources, no flags, no code generation.
 *
 * Material and geometry hashes are cached per wrapper and valid while the wrapper's change stamp is unchanged.
 * The first primitive to ask after a change gets `computed: true`; every other primitive sharing that material or
 * geometry reads the cached hashes (`computed: false`) without any convertToHash() call.
 *
 * Owned by one Renderer, like its managers: `computed: false` means "the resources for these hashes were already
 * ensured in this renderer's managers when the hashes were computed". Resource eviction, when it exists, must
 * drop the matching entries here.
 */
export class HashResolver {
    private readonly hasher: Hasher;
    private readonly materials = new WeakMap<MaterialWrapper, CacheEntry<MaterialHashes>>();
    private readonly geometries = new WeakMap<GeometryWrapper, CacheEntry<GeometryHashes>>();

    constructor(hasher: Hasher) {
        this.hasher = hasher;
    }

    /** @param material
     @param getBindingPlan the producer's per-frame binding plan cache, so the layout hash never plans bindings itself */
    resolveMaterial(material: MaterialWrapper, getBindingPlan: (material: MaterialWrapper) => MaterialBindingPlan): Resolved<MaterialHashes> {
        const builtAt = material.hashProvider.getChangedAt();
        const cached = this.materials.get(material);
        if (cached && cached.builtAt === builtAt) return {hashes: cached.hashes, computed: false};

        const h = this.hasher;
        const textures = new Map<string, MaterialTextureHashes>();
        for (const component of material.getSortedComponents()) {
            const slot = component.getTexture();
            if (!slot) continue;
            textures.set(component.name, {
                image: slot.wrapper.getImage().hashProvider.convertToHash(h),
                sampler: slot.wrapper.getSampler().hashProvider.convertToHash(h),
            });
        }

        const hashes: MaterialHashes = {
            factors: material.hashProvider.convertToFactorsHash(h),
            layout: material.hashProvider.convertToBindgroupLayoutHash(h, getBindingPlan(material).signature),
            bindgroup: material.hashProvider.convertToBindgroupHash(h),
            shader: material.hashProvider.convertToShaderHash(h),
            pipelineSettings: material.hashProvider.convertToPipelineSettingsHash(h),
            textures,
        };
        this.materials.set(material, {builtAt, hashes});
        return {hashes, computed: true};
    }

    resolveImage(image: ImageWrapper) {
        return image.hashProvider.convertToHash(this.hasher)
    }

    resolveGeometry(geometry: GeometryWrapper): Resolved<GeometryHashes> {
        const builtAt = geometry.hashProvider.getChangedAt();
        const cached = this.geometries.get(geometry);
        if (cached && cached.builtAt === builtAt) return {hashes: cached.hashes, computed: false};

        const h = this.hasher;
        const attributeBuffers = new Map<string, string>();
        for (const attribute of geometry.getAttributes().values()) {
            attributeBuffers.set(attribute.name, attribute.hashProvider.convertToHash());
        }

        const hashes: GeometryHashes = {
            attributesShape: geometry.hashProvider.convertToAttributesShapeHash(h),
            attributeBuffers,
            indices: geometry.getIndices()?.hashProvider.convertToHash(),
        };
        this.geometries.set(geometry, {builtAt, hashes});
        return {hashes, computed: true};
    }

    /**
     * Per primitive. Needs the shader hashes, so it runs after code generation. `computed` is true when any pipeline
     * input differs from what this primitive's pipeline was last resolved with.
     */
    resolvePipeline(pipeline: PipelineWrapper, material: MaterialHashes, geometry: GeometryHashes): Resolved<PipelineHashes> {
        const h = this.hasher;
        const vertexShader = pipeline.getVertexShaderWrapper().hashProvider.convertToHash(h);
        const fragmentShader = pipeline.getFragmentShaderWrapper().hashProvider.convertToHash(h);

        const changed = pipeline.hashProvider.setInputs(vertexShader, fragmentShader, material.layout, geometry.attributesShape, material.pipelineSettings, "front");
        const hash = changed ? pipeline.hashProvider.convertToHash(h) : pipeline.hashProvider.getCachedHash();

        return {hashes: {vertexShader, fragmentShader, pipeline: hash}, computed: changed};
    }
}
