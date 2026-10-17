import {
    type MaterialFactorsPlan,
    type GeometryAttributePlan,
    getWGSLTypeFromVertexFormat,
    type WGSLType
} from "./utils.ts";
import type {SkinningMethod} from "../skinning/SkinningMethod.ts";
import {
    FACTORS_BINDING,
    NODE_MATRIX_BINDING,
    NODE_PALETTE_BINDING,
    type MaterialBindingPlan
} from "./BindGroupLayoutProducer.ts";

export interface VertexInputField {
    name: string;
    id: string;
    type: WGSLType;
    location: number
}

export type BindGroupEntry =
    | BindGroupUniformEntry
    | BindGroupStorageEntry
    | BindGroupTextureEntry
    | BindGroupSamplerEntry;

export type Struct = { structName: string; fields: StructField[] };

export interface StructField {
    name: string;
    type: WGSLType;
    offset: number;
}


export interface BindGroupUniformEntry {
    kind: "uniform";
    group: number;
    binding: number;
    name: string;
    struct: Struct,
    size: number;         // total struct byte size
}

export interface BindGroupStorageEntry {
    kind: "storage";
    group: number;
    binding: number;
    name: string;
    struct: Struct,
    access: "read" | "read_write";
}

export interface BindGroupTextureEntry {
    kind: "texture";
    group: number;
    binding: number;
    name: string;
    textureType: string;
}

export interface BindGroupSamplerEntry {
    kind: "sampler";
    group: number;
    binding: number;
    name: string;
    samplerType: string;
}


export interface VertexShaderDescriptor {
    inputs: VertexInputField[];
    bindings: BindGroupEntry[],
    componentDataMap: Map<string, {
        uv?: string
    }>
    extraCode: string
}

export interface FragmentShaderDescriptor {
    bindings: BindGroupEntry[];
}


export function toWgslIdentifier(name: string): string {
    const id = name.replace(/[^A-Za-z0-9_]/g, "_");
    return /^[A-Za-z]/.test(id) ? id : `a_${id}`;
}

export function sceneBindings(): BindGroupEntry[] {
    return [
        {
            kind: "uniform",
            group: 0,
            binding: 0,
            name: "camera",
            struct: {
                structName: "CameraUniforms",
                fields: [
                    {name: "view", type: "mat4x4f", offset: 0},
                    {name: "projection", type: "mat4x4f", offset: 64},
                ],
            },
            size: 128,
        },
    ];
}

// --- Group 2 (per-primitive/node) — two shapes: plain, and skinned (adds the joint palette) ----------

export function nodeBindings(skinning?: SkinningMethod): BindGroupEntry[] {
    const entries: BindGroupEntry[] = [
        {
            kind: "uniform",
            group: 2,
            binding: NODE_MATRIX_BINDING,
            name: "node",
            struct: {
                structName: "NodeUniforms",
                fields: [
                    {name: "worldMatrix", type: "mat4x4f", offset: 0},
                ],
            },
            size: 64,
        },
    ];

    if (skinning) {
        // the element type is the method's: the engine declares the binding, the method decides what one joint is
        entries.push({
            kind: "storage",
            group: 2,
            binding: NODE_PALETTE_BINDING,
            name: "palette",
            struct: {
                structName: skinning.paletteElement.structName,
                fields: skinning.paletteElement.fields,
            },
            access: "read",
        });
    }

    return entries;
}

export class VertexShaderProducer {
    static produce(getMaterialPlan: () => MaterialBindingPlan, getAttributePlan: () => GeometryAttributePlan, skinning?: SkinningMethod): VertexShaderDescriptor {
        const plan = getAttributePlan();
        const matPlan = getMaterialPlan();
        const componentDataMap: VertexShaderDescriptor["componentDataMap"] = new Map()
        matPlan.byComponent.forEach((i, name) => {
            if (i.texture) {
                componentDataMap.set(name, {
                    uv: i.texCoord
                })
            }
        })

        let extraCode = ''
        extraCode += skinning?.code ?? "" + '\n';

        const inputs: VertexInputField[] = plan.slots.map((s) => ({
            name: s.name,
            id: toWgslIdentifier(s.name),
            type: getWGSLTypeFromVertexFormat(s.format),
            location: s.shaderLocation,
        }));


        return {
            inputs,
            componentDataMap,
            bindings: [...sceneBindings(), ...nodeBindings(skinning)],
            extraCode
        };
    }
}

function materialBindings(bindingPlan: MaterialBindingPlan, factorPlan: MaterialFactorsPlan): BindGroupEntry[] {
    const FactorFields: StructField[] = [];
    let FactorSize = 0;
    factorPlan.forEach((item, name) => {
        FactorFields.push({offset: item.offset, type: item.wgslType, name});
        FactorSize += typeof item.factor === "number" ? 1 : item.factor.length;
    });

    const entries: BindGroupEntry[] = [{
        kind: "uniform", group: 1, binding: FACTORS_BINDING,
        name: "material", struct: {
            structName: "MaterialUniforms",
            fields: FactorFields
        }, size: FactorSize,
    }];

    const owner = new Map<number, { componentName: string; texCoord: string }>();
    for (const [componentName, {texture, sampler, texCoord}] of bindingPlan.byComponent) {
        owner.set(texture, {componentName, texCoord});
        owner.set(sampler, {componentName, texCoord});
    }

    for (const slot of bindingPlan.slots) {
        entries.push(
            slot.kind === "texture"
                ? {
                    kind: "texture",
                    group: 1,
                    binding: slot.binding,
                    name: `texture${slot.binding}`,
                    textureType: "texture_2d<f32>",
                }
                : {
                    kind: "sampler",
                    group: 1,
                    binding: slot.binding,
                    name: `sampler${slot.binding}`,
                    samplerType: "sampler",
                }
        );
    }
    return entries;
}

export interface FragmentComponentData {
    hasFactor: boolean;
    textureBindingName?: string;
    samplerBindingName?: string;
    texCoord?: string;
}

export interface FragmentShaderDescriptor {
    bindings: BindGroupEntry[];
    componentDataMap: Map<string, FragmentComponentData>;
}

function fragmentComponentDataMap(
    bindingPlan: MaterialBindingPlan,
    factorPlan: MaterialFactorsPlan,
): Map<string, FragmentComponentData> {
    const map = new Map<string, FragmentComponentData>();
    const touch = (name: string) => {
        let entry = map.get(name);
        if (!entry) map.set(name, (entry = {hasFactor: false}));
        return entry;
    };

    for (const name of factorPlan.keys()) {
        touch(name).hasFactor = true;
    }

    for (const [name, {texture, sampler, texCoord}] of bindingPlan.byComponent) {
        const entry = touch(name);
        entry.textureBindingName = `texture${texture}`;
        entry.samplerBindingName = `sampler${sampler}`;
        entry.texCoord = texCoord;
    }

    return map;
}

export class FragmentShaderProducer {
    static produce(
        getBindingPlan: () => MaterialBindingPlan,
        getFactorsPlan: () => MaterialFactorsPlan,
    ): FragmentShaderDescriptor {
        const bindingPlan = getBindingPlan();
        const factorPlan = getFactorsPlan();
        return {
            bindings: [...sceneBindings(), ...materialBindings(bindingPlan, factorPlan)],
            componentDataMap: fragmentComponentDataMap(bindingPlan, factorPlan),
        };
    }
}