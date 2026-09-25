import {
    type BindingSlot,
    type ComponentBindings,
    FACTORS_BINDING,
    type MaterialBindingPlan
} from "./BindGroupLayoutProducer.ts";
import type {MaterialComponentWrapper} from "../wrappers/MaterialComponentWrapper.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";

export type WGSLType =
    | 'f32'
    | 'f16'
    | 'bool'
    | 'vec2f'
    | 'vec2h'
    | 'vec3f'
    | 'vec3h'
    | 'vec4f'
    | 'vec4h'
    | 'i32'
    | 'vec2i'
    | 'vec3i'
    | 'vec4i'
    | 'u32'
    | 'vec2u'
    | 'vec3u'
    | "mat4x4f"
    | 'vec4u';


export function getWGSLTypeFromVertexFormat(format: GPUVertexFormat): WGSLType {
    switch (format) {
        // Float types
        case 'float32':
            return 'f32';
        case 'float16':
            return 'f16';

        // Vec2 types
        case 'float32x2':
            return 'vec2f';
        case 'float16x2':
            return 'vec2h';

        // Vec3 types
        case 'float32x3':
            return 'vec3f';

        // Vec4 types
        case 'float32x4':
            return 'vec4f';
        case 'float16x4':
            return 'vec4h';

        // Sint (signed integer) types
        case 'sint8':
        case 'sint16':
        case 'sint32':
            return 'i32';

        // Sint vec2 types
        case 'sint8x2':
        case 'sint16x2':
        case 'sint32x2':
            return 'vec2i';

        case 'sint32x3':
            return 'vec3i';

        // Sint vec4 types
        case 'sint8x4':
        case 'sint16x4':
        case 'sint32x4':
            return 'vec4i';

        // Uint (unsigned integer) types
        case 'uint8':
        case 'uint16':
        case 'uint32':
            return 'u32';

        // Uint vec2 types
        case 'uint8x2':
        case 'uint16x2':
        case 'uint32x2':
            return 'vec2u';

        case 'uint32x3':
            return 'vec3u';

        // Uint vec4 types
        case 'uint8x4':
        case 'uint16x4':
        case 'uint32x4':
            return 'vec4u';

        // Unorm types (normalized unsigned)
        case 'unorm8':
        case 'unorm16':
            return 'f32'; // Unorm values are accessed as floats
        case 'unorm8x2':
        case 'unorm16x2':
            return 'vec2f';
        case 'unorm8x4':
        case 'unorm16x4':
            return 'vec4f';

        // Snorm types (normalized signed)
        case 'snorm8':
        case 'snorm16':
            return 'f32'; // Snorm values are accessed as floats
        case 'snorm8x2':
        case 'snorm16x2':
            return 'vec2f';
        case 'snorm8x4':
        case 'snorm16x4':
            return 'vec4f';

        default:
            // Handle unknown format
            throw new Error(`Unsupported GPUVertexFormat: ${format}`);
    }
}

const FORMAT_BYTE_SIZE_MAP = new Map<GPUVertexFormat, number>([
    // Float types
    ["float32", 4],
    ["float16", 2],
    ["float32x2", 8],
    ["float32x3", 12],
    ["float32x4", 16],
    ["float16x2", 4],
    ["float16x4", 8],

    // Signed integer types
    ["sint8", 1],
    ["sint16", 2],
    ["sint32", 4],
    ["sint8x2", 2],
    ["sint8x4", 4],
    ["sint16x2", 4],
    ["sint16x4", 8],
    ["sint32x2", 8],
    ["sint32x3", 12],
    ["sint32x4", 16],

    // Unsigned integer types
    ["uint8", 1],
    ["uint16", 2],
    ["uint32", 4],
    ["uint8x2", 2],
    ["uint8x4", 4],
    ["uint16x2", 4],
    ["uint16x4", 8],
    ["uint32x2", 8],
    ["uint32x3", 12],
    ["uint32x4", 16],

    // Normalized unsigned types
    ["unorm8", 1],
    ["unorm8x2", 2],
    ["unorm8x4", 4],
    ["unorm16", 2],
    ["unorm16x2", 4],
    ["unorm16x4", 8],

    // Normalized signed types
    ["snorm8", 1],
    ["snorm8x2", 2],
    ["snorm8x4", 4],
    ["snorm16", 2],
    ["snorm16x2", 4],
    ["snorm16x4", 8],
]);

export function getVertexFormatSize(format: GPUVertexFormat): number {
    const size = FORMAT_BYTE_SIZE_MAP.get(format);
    if (size === undefined) {
        throw new Error(`Unknown GPUVertexFormat: ${format}`);
    }
    return size;
}

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export interface AttributeSlot {
    name: string;
    slot: number;            // the i in setVertexBuffer(i, ...)
    shaderLocation: number;  // @location(n) in the shader
    format: GPUVertexFormat;
    arrayStride: number;
}

export interface GeometryAttributePlan {
    slots: AttributeSlot[];
    byName: Map<string, AttributeSlot>;
}

export function planGeometryAttributes(geometry: GeometryWrapper): GeometryAttributePlan {
    const sorted = [...geometry.getAttributes().values()]
        .sort((a, b) => byCodeUnit(a.name, b.name));

    const slots = sorted.map((attr, i): AttributeSlot => {
        const format = attr.format;
        const arrayStride = attr.stride;
        if (arrayStride === undefined) throw new Error(`planGeometryAttributes: unsupported format "${format}"`);
        return {name: attr.name, slot: i, shaderLocation: i, format, arrayStride};
    });

    return {slots, byName: new Map(slots.map((s) => [s.name, s]))};
}

export function planMaterialBindings(sorted: MaterialComponentWrapper[]): MaterialBindingPlan {
    let next = FACTORS_BINDING + 1;
    const imageBinding = new Map<string, number>();
    const samplerBinding = new Map<string, number>();
    const slots: BindingSlot[] = [];
    const byComponent = new Map<string, ComponentBindings>();
    const parts: string[] = [];

    for (const c of sorted) {
        const slot = c.getTexture();
        if (!slot) {
            parts.push(`${c.name}:-`);
            continue;
        }

        const image = slot.wrapper.getImage();
        const sampler = slot.wrapper.getSampler();

        let t = imageBinding.get(image.uuid);
        if (t === undefined) {
            t = next++;
            imageBinding.set(image.uuid, t);
            slots.push({ binding: t, kind: "texture" });
        }

        let s = samplerBinding.get(sampler.uuid);
        if (s === undefined) {
            s = next++;
            samplerBinding.set(sampler.uuid, s);
            slots.push({ binding: s, kind: "sampler" });
        }

        byComponent.set(c.name, { texture: t, sampler: s, texCoord: slot.texCoord });
        parts.push(`${c.name}:${t},${s},${slot.texCoord}`);
    }

    return { slots, byComponent, signature: parts.join("|") };
}

type FactorsPlanEntry = {
    offset: number;
    wgslType: WGSLType;
    factor: number | number[];
};

export type MaterialFactorsPlan = Map<string, FactorsPlanEntry>;

function resolveWgslType(factor: number | number[]): { wgslType: WGSLType; size: number; align: number } {
    if (typeof factor === "number") return {wgslType: "f32", size: 4, align: 4};

    switch (factor.length) {
        case 2:
            return {wgslType: "vec2f", size: 8, align: 8};
        case 3:
            return {wgslType: "vec3f", size: 12, align: 16};
        case 4:
            return {wgslType: "vec4f", size: 16, align: 16};
        default:
            throw new Error(`unsupported factor arity: ${(factor as number[]).length}`);
    }
}

export function planMaterialFactors(material: MaterialWrapper): MaterialFactorsPlan {
    const plan: MaterialFactorsPlan = new Map();
    let cursor = 0;
    let padIdx = 0;

    const align = (n: number) => {
        const rem = cursor % n;
        if (rem === 0) return;
        const gap = n - rem;
        plan.set(`_padding${padIdx++}`, {
            offset: cursor,
            wgslType: gap === 4 ? "f32" as WGSLType : `array<f32, ${gap / 4}>` as WGSLType,
            factor: gap === 4 ? 0 : new Array(gap / 4).fill(0),
        });
        cursor += gap;
    };

    const push = (name: string, factor: number | number[]) => {
        const {wgslType, size, align: a} = resolveWgslType(factor);
        align(a);
        plan.set(name, {offset: cursor, wgslType, factor});
        cursor += size;
    };

    for (const component of material.getAllComponents()) {
        push(component.name, component.getFactors());
    }

    push("alphaCutOff", material.getAlphaCutoff());

    align(16);

    return plan;
}