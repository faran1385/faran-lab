import type {BindGroupEntry} from "./ShaderDescriptorProducer.ts";

export type WGSLType =
    | 'f32'
    | 'f16'
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



export function hashBindGroupEntry(e: BindGroupEntry): string {
    switch (e.kind) {
        case "uniform":
            return `u:${e.group}:${e.binding}:${e.name}:${e.fields.map(f => `${f.name}:${f.type}:${f.offset}`).join(",")}`;
        case "storage":
            return `s:${e.group}:${e.binding}:${e.name}:${e.access}:${e.elementFields.map(f => `${f.name}:${f.type}:${f.offset}`).join(",")}`;
        case "texture":
            return `t:${e.group}:${e.binding}:${e.name}:${e.textureType}`;
        case "sampler":
            return `sm:${e.group}:${e.binding}:${e.name}:${e.samplerType}`;
    }
}