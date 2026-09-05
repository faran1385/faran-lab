
// ShaderDescriptorProducer.ts

import type {ShaderTargetField} from "../wrappers/FragmentShaderWrapper.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {VertexInputField, VertexOutputField} from "../wrappers/VertexShaderWrapper.ts";
import {getWGSLTypeFromVertexFormat, type WGSLType} from "./utils.ts";
import {type MaterialBindingLayout} from "./MaterialDescriptorProducer.ts";


// --- shader-bindings.ts ---------------------------------------------------

export type BindGroupEntry =
    | BindGroupUniformEntry
    | BindGroupStorageEntry
    | BindGroupTextureEntry
    | BindGroupSamplerEntry;

interface StructField {
    name: string;
    type: WGSLType;
    offset: number;
}

export interface BindGroupUniformEntry {
    kind: "uniform";
    group: number;
    binding: number;
    name: string;        // WGSL variable name
    structName: string;  // WGSL struct type name
    fields: StructField[];
    size: number;         // total struct byte size
}

export interface BindGroupStorageEntry {
    kind: "storage";
    group: number;
    binding: number;
    name: string;
    elementStructName: string;
    elementFields: StructField[];
    access: "read" | "read_write";
}

export interface BindGroupTextureEntry {
    kind: "texture";
    group: number;
    binding: number;
    name: string;
    textureType: string; // e.g. "texture_2d<f32>", "texture_depth_2d"
}

export interface BindGroupSamplerEntry {
    kind: "sampler";
    group: number;
    binding: number;
    name: string;
    samplerType: string; // "sampler" | "sampler_comparison"
}

// --- Group 0 (frame/scene) — fixed shape, same every frame ---------------

export function sceneBindings(): BindGroupEntry[] {
    return [
        {
            kind: "uniform",
            group: 0,
            binding: 0,
            name: "scene",
            structName: "SceneUniforms",
            fields: [
                { name: "view", type: "mat4x4f", offset: 0 },
                { name: "projection", type: "mat4x4f", offset: 64 },
                { name: "viewProjection", type: "mat4x4f", offset: 128 },
                { name: "cameraPosition", type: "vec3f", offset: 192 },
                { name: "lightCount", type: "u32", offset: 204 },
            ],
            size: 208,
        },
        {
            kind: "storage",
            group: 0,
            binding: 1,
            name: "lights",
            elementStructName: "Light",
            elementFields: [
                { name: "position", type: "vec3f", offset: 0 },
                { name: "lightType", type: "u32", offset: 12 },
                { name: "direction", type: "vec3f", offset: 16 },
                { name: "range", type: "f32", offset: 28 },
                { name: "color", type: "vec3f", offset: 32 },
                { name: "intensity", type: "f32", offset: 44 },
            ],
            access: "read",
        },
        // Shadow maps deferred — no shadow-casting light wiring yet.
        // Will be texture_depth_2d(_array) + sampler_comparison entries here.
    ];
}

// --- Group 2 (per-primitive/node) — fixed shape for now -------------------

export function nodeBindings(): BindGroupEntry[] {
    return [
        {
            kind: "uniform",
            group: 2,
            binding: 0,
            name: "node",
            structName: "NodeUniforms",
            fields: [
                { name: "worldMatrix", type: "mat4x4f", offset: 0 },
            ],
            size: 64,
        },
        // Skinning matrices deferred, same as everywhere else.
    ];
}


export function materialBindings(layout: MaterialBindingLayout): BindGroupEntry[] {
    const entries: BindGroupEntry[] = [];

    if (layout.uniformBufferBinding !== null) {
        const fields = Object.entries(layout.components)
            .filter(([, c]) => c.uniform !== null)
            .map(([name, c]): StructField => ({ name, type: c.uniform!.type, offset: c.uniform!.offset }))
            .sort((a, b) => a.offset - b.offset);

        entries.push({
            kind: "uniform",
            group: 1,
            binding: layout.uniformBufferBinding,
            name: "material",
            structName: "MaterialUniforms",
            fields,
            size: layout.uniformBufferSize,
        });
    }


    const seenTextureBindings = new Set<number>();
    const seenSamplerBindings = new Set<number>();

    for (const component of Object.values(layout.components)) {
        if (!component.texture) continue;
        const { textureBinding, samplerBinding } = component.texture;

        if (!seenTextureBindings.has(textureBinding)) {
            seenTextureBindings.add(textureBinding);
            entries.push({
                kind: "texture", group: 1, binding: textureBinding,
                name: `texture${textureBinding}`, textureType: "texture_2d<f32>",
            });
        }

        if (!seenSamplerBindings.has(samplerBinding)) {
            seenSamplerBindings.add(samplerBinding);
            entries.push({
                kind: "sampler", group: 1, binding: samplerBinding,
                name: `sampler${samplerBinding}`, samplerType: "sampler",
            });
        }
    }

    return entries;
}

export class ShaderDescriptorProducer {
    static produce(primitives: PrimitiveWrapper[]): void {
        for (const primitive of primitives) {
            const materialLayout = primitive.getMaterial().getLayoutDescriptor()
            ShaderDescriptorProducer.produceVertex(primitive);
            ShaderDescriptorProducer.produceFragment(primitive, materialLayout);
        }
    }

    private static produceVertex(primitive: PrimitiveWrapper): void {
        const attrLayout = primitive.getGeometry().getLayoutDescriptor()

        const inputs: VertexInputField[] = [...attrLayout.entries()].map(([name, layout]) => ({
            name,
            type: getWGSLTypeFromVertexFormat(layout.format),
            location: layout.shaderLocation,
        }));

        const varyingNames = [...attrLayout.keys()].filter((name) => name !== "position").sort();

        const outputs: VertexOutputField[] = [
            { kind: "builtin", name: "position", type: "vec4f", builtin: "position" },
            ...varyingNames.map((name, index): VertexOutputField => {
                const layout = attrLayout.get(name)!;
                return { kind: "varying", name, type: getWGSLTypeFromVertexFormat(layout.format), location: index };
            }),
        ];

        // Vertex stage gets scene (group 0) + node (group 2) only — nothing
        // reads material data (group 1) from the vertex stage yet.
        const bindings: BindGroupEntry[] = [...sceneBindings(), ...nodeBindings()];
        primitive.getPipeline().getVertexShaderWrapper()!.setInputs(inputs);
        primitive.getPipeline().getVertexShaderWrapper()!.setOutputs(outputs);
        primitive.getPipeline().getVertexShaderWrapper()!.setBindings(bindings);
    }

    private static produceFragment(primitive: PrimitiveWrapper, materialLayout: MaterialBindingLayout): void {
        const outputs: ShaderTargetField[] = [
            { location: 0, wgslType: "vec4f", format: "bgra8unorm" },
        ];

        const bindings: BindGroupEntry[] = [...sceneBindings(), ...materialBindings(materialLayout)];
        primitive.getPipeline().getFragmentShaderWrapper()!.setOutputs(outputs);
        primitive.getPipeline().getFragmentShaderWrapper()!.setBindings(bindings);
    }
}