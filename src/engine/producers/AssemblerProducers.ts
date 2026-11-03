import {
    type MaterialFactorsPlan,
    type GeometryAttributePlan,
    getWGSLTypeFromVertexFormat,
    type WGSLType
} from "./utils.ts";
import {FACTORS_BINDING, type MaterialBindingPlan, type GeometryBindingPlan} from "./BindGroupLayoutProducer.ts";
import {morphGeometryBindings, morphNodeBindings, type MorphPlan} from "./MorphProducer.ts";
import {getVATGeometryBindings, type VATPlan} from "./VATProducer.ts";

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
    uniformType: string,
    size: number;         // total struct byte size
}

export interface BindGroupStorageEntry {
    kind: "storage";
    group: number;
    binding: number;
    name: string;
    storageType: string,
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


/** A WGSL struct: name plus fields. Used for the palette's element type. */
export interface Struct {
    structName: string;
    fields: StructField[];
}

/**
 * What the vertex shader needs from a node's Skinning method (see SkinningMethod for the WGSL contract). `id` keys the
 * vertex stage variants a primitive keeps, so it must change whenever `code` or `paletteElement` does.
 */
export interface SkinShaderInfo {
    id: string;
    code: string;
    paletteElement: Struct;
}

/** Binding of the skin palette inside the node bind group (group 1, next to the world matrix at binding 0). */
export const PALETTE_BINDING = 1;

export function paletteBinding(element: Struct): BindGroupStorageEntry {
    return {
        kind: "storage",
        group: 1,
        binding: PALETTE_BINDING,
        name: "palette",
        storageType: element.structName,
        access: "read",
    };
}

export interface VertexShaderDescriptor {
    inputs: VertexInputField[];
    bindings: BindGroupEntry[],
    structs: Struct[]
    componentDataMap: Map<string, {
        uv?: string
    }>,
    /** Set for a skinned node: the assembler declares the palette and the method's code, and calls `skin`. */
    skin?: SkinShaderInfo;
    /** Set when the geometry has morph targets: the assembler declares the morph helpers and may call them. */
    morph?: MorphPlan;
    vat?: VATPlan
}


function toWgslIdentifier(name: string): string {
    const id = name.replace(/[^A-Za-z0-9_]/g, "_");
    return /^[A-Za-z]/.test(id) ? id : `a_${id}`;
}

export function sceneBindings(): {
    entries: BindGroupEntry[],
    structs: Struct[]
} {
    return {
        entries: [
            {
                kind: "uniform",
                group: 0,
                binding: 0,
                name: "camera",
                uniformType: "CameraUniforms",
                size: 128,
            },
        ],
        structs: [{
            structName: "CameraUniforms",
            fields: [
                {name: "view", type: "mat4x4f", offset: 0},
                {name: "projection", type: "mat4x4f", offset: 64},
            ],
        }]
    }
}

// --- Group 2 (per-primitive/node) — fixed shape for now -------------------

export function nodeBindings(): {
    entries: BindGroupEntry[],
    structs: Struct[]
} {

    return {
        entries: [
            {
                kind: "uniform",
                group: 1,
                binding: 0,
                name: "node",
                uniformType: "NodeUniforms",
                size: 64,
            },
        ],
        structs: [{
            structName: "NodeUniforms",
            fields: [
                {name: "worldMatrix", type: "mat4x4f", offset: 0},
            ],
        }]
    }
}

export class VertexShaderProducer {
    static produce(
        getMaterialPlan: () => MaterialBindingPlan,
        getAttributePlan: () => GeometryAttributePlan,
        skin?: SkinShaderInfo,
        getMorphPlan?: () => MorphPlan | null,
        getGeometryBindingPlan?: () => GeometryBindingPlan,
    ): VertexShaderDescriptor {
        const plan = getAttributePlan();
        const matPlan = getMaterialPlan();
        const morph = getMorphPlan?.() ?? undefined;
        const geoPlan = getGeometryBindingPlan?.() ?? undefined;
        const scene = sceneBindings();
        const node = nodeBindings();

        const bindings = [...scene.entries, ...node.entries];
        const structs: Struct[] = [...scene.structs, ...node.structs];

        const componentDataMap: VertexShaderDescriptor["componentDataMap"] = new Map()
        matPlan.byComponent.forEach((i, name) => {
            if (i.texture) {
                componentDataMap.set(name, {
                    uv: i.texCoord
                })
            }
        })

        const inputs: VertexInputField[] = plan.slots.map((s) => ({
            name: s.name,
            id: toWgslIdentifier(s.name),
            type: getWGSLTypeFromVertexFormat(s.format),
            location: s.shaderLocation,
        }));


        if (skin) {
            structs.push(skin.paletteElement)
            bindings.push(paletteBinding(skin.paletteElement));
        }

        if (morph && geoPlan) {
            const morphDelta = geoPlan.byComponent.get("morph-delta");
            const morphHeader = geoPlan.byComponent.get("morph-header");
            if (morphDelta && morphHeader) {
                const nodeBindings = morphNodeBindings();
                const geometryBindings = morphGeometryBindings(geoPlan);

                structs.push(...nodeBindings.structs, ...geometryBindings.structs)
                bindings.push(...nodeBindings.entries, ...geometryBindings.entries);
            }
        }
        let vatPlan: undefined | VATPlan;
        if (geoPlan) {
            const vatBindings = getVATGeometryBindings(geoPlan)

            if(vatBindings){
                vatPlan = vatBindings.plan;
                structs.push(...vatBindings.structs);
                bindings.push(...vatBindings.entries);
            }
        }

        return {inputs, componentDataMap, structs, bindings, skin, morph, vat: vatPlan};
    }
}

function materialBindings(bindingPlan: MaterialBindingPlan, factorPlan: MaterialFactorsPlan) {
    const FactorFields: StructField[] = [];
    let FactorSize = 0;
    const structs: Struct[] = []

    factorPlan.forEach((item, name) => {
        FactorFields.push({offset: item.offset, type: item.wgslType, name});
        FactorSize += typeof item.factor === "number" ? 1 : item.factor.length;
    });

    structs.push({
        structName: 'MaterialUniforms',
        fields: FactorFields
    })

    const entries: BindGroupEntry[] = [{
        kind: "uniform", group: 2, binding: FACTORS_BINDING,
        name: "material", uniformType: "MaterialUniforms",
        size: FactorSize,
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
                    group: 2,
                    binding: slot.binding,
                    name: `texture${slot.binding}`,
                    textureType: "texture_2d<f32>",
                }
                : {
                    kind: "sampler",
                    group: 2,
                    binding: slot.binding,
                    name: `sampler${slot.binding}`,
                    samplerType: "sampler",
                }
        );
    }
    return {
        entries,
        structs
    };
}

export interface FragmentComponentData {
    hasFactor: boolean;
    textureBindingName?: string;
    samplerBindingName?: string;
    texCoord?: string;
}

export interface FragmentShaderDescriptor {
    bindings: BindGroupEntry[];
    componentDataMap: Map<string, FragmentComponentData>,
    structs: Struct[],
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

        const scene = sceneBindings();
        const material = materialBindings(bindingPlan, factorPlan);

        return {
            structs: [...scene.structs, ...material.structs],
            bindings: [...scene.entries, ...material.entries],
            componentDataMap: fragmentComponentDataMap(bindingPlan, factorPlan),
        };
    }
}