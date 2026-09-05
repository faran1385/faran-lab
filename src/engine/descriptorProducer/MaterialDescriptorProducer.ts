import {Hasher} from "../hashing/Hasher.ts";
import {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import {MaterialComponentWrapper} from "../wrappers/MaterialComponentWrapper.ts";


// --- Types ------------------------------------------------------------

type WgslFactorType = "f32" | "vec2f" | "vec3f" | "vec4f";

const WGSL_LAYOUT: Record<WgslFactorType, { size: number; align: number }> = {
    f32: {size: 4, align: 4},
    vec2f: {size: 8, align: 8},
    vec3f: {size: 12, align: 16}, // occupies the same room as vec4 in a struct
    vec4f: {size: 16, align: 16},
};

export interface UniformFieldLayout {
    type: WgslFactorType;
    offset: number;
    size: number;
}

export interface TextureFieldLayout {
    textureBinding: number;
    samplerBinding: number;
}

export interface ComponentBindingLayout {
    name: string;
    uniform: UniformFieldLayout | null; // null = this component contributes no factor bytes
    texture?: TextureFieldLayout;       // absent = this component has no texture
}

export interface MaterialBindingLayout {
    uniformBufferSize: number;
    uniformBufferBinding: number | null; // null when uniformBufferSize === 0 — nothing to bind
    distinctTextureCount: number;
    distinctSamplerCount: number;
    components: Record<string, ComponentBindingLayout>;

    getUniformField(name: string): UniformFieldLayout | null | undefined;

    getTextureBinding(name: string): TextureFieldLayout | undefined;
}

// --- Step 1: factor length -> WGSL type --------------------------------

function inferFactorType(name: string, length: number): WgslFactorType {
    switch (length) {
        case 1:
            return "f32";
        case 2:
            return "vec2f";
        case 3:
            return "vec3f";
        case 4:
            return "vec4f";
        default:
            throw new Error(
                `DescriptorProducer: component "${name}" has ${length} factors — only 1-4 are supported`
            );
    }
}

// --- Step 2: uniform buffer offsets -------------------------------------

function computeUniformLayout(
    components: MaterialComponentWrapper[]
): { fields: Record<string, UniformFieldLayout | null>; totalSize: number } {
    const fields: Record<string, UniformFieldLayout | null> = {};

    let cursor = 0;
    let maxAlign = 4; // struct's own alignment floor

    for (const component of components) {
        const factors = component.getFactors();

        if (factors.length === 0) {
            fields[component.name] = null; // explicitly "skipped", not "forgotten"
            continue;
        }

        const type = inferFactorType(component.name, factors.length);
        const {size, align} = WGSL_LAYOUT[type];

        const offset = alignUp(cursor, align);
        cursor = offset + size;
        maxAlign = Math.max(maxAlign, align);

        fields[component.name] = {type, offset, size};
    }

    const totalSize = components.length === 0 ? 0 : alignUp(cursor, maxAlign);
    return {fields, totalSize};
}

function alignUp(offset: number, align: number): number {
    return (offset + align - 1) & ~(align - 1);
}

// --- Step 3: texture/sampler binding dedup ------------------------------

function computeTextureBindings(
    components: MaterialComponentWrapper[],
    hasher: Hasher,
    startBinding: number
): {
    fields: Record<string, TextureFieldLayout | undefined>;
    distinctTextureCount: number;
    distinctSamplerCount: number;
} {
    const fields: Record<string, TextureFieldLayout | undefined> = {};
    const textureHashToBinding = new Map<string, number>();
    const samplerHashToBinding = new Map<string, number>();
    let nextBinding = startBinding;

    for (const component of components) {
        const slot = component.getTexture();
        if (!slot) continue;

        const sampler = slot.wrapper.getSampler();
        if (!sampler) {
            // Invariant guaranteed by WireUpLayer's default-sampler fallback.
            // If this fires, something upstream skipped WireUp — fail loud.
            throw new Error(
                `DescriptorProducer: component "${component.name}" has a texture with no sampler — WireUpLayer should have assigned a default`
            );
        }

        const textureHash = slot.wrapper.convertToHash(hasher);
        const samplerHash = sampler.convertToHash(hasher);

        let textureBinding = textureHashToBinding.get(textureHash);
        if (textureBinding === undefined) {
            textureBinding = nextBinding++;
            textureHashToBinding.set(textureHash, textureBinding);
        }

        let samplerBinding = samplerHashToBinding.get(samplerHash);
        if (samplerBinding === undefined) {
            samplerBinding = nextBinding++;
            samplerHashToBinding.set(samplerHash, samplerBinding);
        }

        fields[component.name] = {textureBinding, samplerBinding};
    }

    return {
        fields,
        distinctTextureCount: textureHashToBinding.size,
        distinctSamplerCount: samplerHashToBinding.size,
    };
}

// --- Step 4: assemble ----------------------------------------------------

function assembleLayout(
    components: MaterialComponentWrapper[],
    uniformResult: ReturnType<typeof computeUniformLayout>,
    textureResult: ReturnType<typeof computeTextureBindings>,
    uniformBufferBinding: number | null
): MaterialBindingLayout {
    const map: Record<string, ComponentBindingLayout> = {};

    for (const component of components) {
        map[component.name] = {
            name: component.name,
            uniform: uniformResult.fields[component.name] ?? null,
            texture: textureResult.fields[component.name],
        };
    }
    return {
        uniformBufferSize: uniformResult.totalSize,
        uniformBufferBinding,
        distinctTextureCount: textureResult.distinctTextureCount,
        distinctSamplerCount: textureResult.distinctSamplerCount,
        components: map,
        getUniformField(name) {
            return map[name]?.uniform;
        },
        getTextureBinding(name) {
            return map[name]?.texture;
        },
    };
}

// --- Public entry point ---------------------------------------------------

export class MaterialDescriptorProducer {
    constructor() {
    }

    static produce(
        mat: MaterialWrapper,
        hasher: Hasher,
        textureBudget: number
    ) {

        const components = mat.getAllComponents().sort((a, b) => a.name.localeCompare(b.name));

        const uniformResult = computeUniformLayout(components);
        const uniformBufferBinding = uniformResult.totalSize > 0 ? 0 : null;

        const textureResult = computeTextureBindings(
            components,
            hasher,
            uniformBufferBinding === null ? 0 : uniformBufferBinding + 1
        );

        if (textureResult.distinctTextureCount > textureBudget) {
            throw new Error(
                `DescriptorProducer: material "${mat.uuid}" needs ${textureResult.distinctTextureCount} distinct textures, budget is ${textureBudget}`
            );
        }

        mat.setLayoutDescriptor(assembleLayout(components, uniformResult, textureResult, uniformBufferBinding))
    }
}