import type {Struct} from "../producers/AssemblerProducers.ts";

/**
 * The WGSL types a described buffer struct may contain: 32-bit scalars, vectors of them, and f32 matrices.
 * (bool is not host-shareable, f16 needs a shader extension, arrays and nested structs are not supported yet.)
 */
export type StructFieldType =
    | "f32" | "i32" | "u32"
    | "vec2f" | "vec3f" | "vec4f"
    | "vec2i" | "vec3i" | "vec4i"
    | "vec2u" | "vec3u" | "vec4u"
    | "mat2x2f" | "mat2x3f" | "mat2x4f"
    | "mat3x2f" | "mat3x3f" | "mat3x4f"
    | "mat4x2f" | "mat4x3f" | "mat4x4f";

type ScalarKind = "f32" | "i32" | "u32";

interface TypeInfo {
    readonly scalar: ScalarKind;
    readonly columns: number;
    readonly rows: number;
    /** AlignOf(T) from the WGSL spec, in bytes. */
    readonly align: number;
    /** SizeOf(T) from the WGSL spec, in bytes. */
    readonly size: number;
    /** Bytes between the starts of two matrix columns (padded: a column of 3 floats takes 16 bytes). */
    readonly columnStride: number;
}

const roundUp = (multiple: number, value: number): number => Math.ceil(value / multiple) * multiple;

/** A vector of n components aligns like n components, except that vec3 aligns like vec4. */
const vectorAlign = (rows: number): number => (rows === 2 ? 8 : 16);

const scalar = (kind: ScalarKind): TypeInfo =>
    ({scalar: kind, columns: 1, rows: 1, align: 4, size: 4, columnStride: 4});

const vec = (kind: ScalarKind, rows: 2 | 3 | 4): TypeInfo =>
    ({scalar: kind, columns: 1, rows, align: vectorAlign(rows), size: rows * 4, columnStride: rows * 4});

/** matCxR: C columns, each a vecR. Columns are laid out like array elements, so each is padded to the vector's alignment. */
const mat = (columns: 2 | 3 | 4, rows: 2 | 3 | 4): TypeInfo => {
    const align = vectorAlign(rows);
    const columnStride = roundUp(align, rows * 4);
    return {scalar: "f32", columns, rows, align, size: columns * columnStride, columnStride};
};

// Typed as a Record over the union, so adding a type to StructFieldType without describing it is a compile error.
const TYPE_INFO: Record<StructFieldType, TypeInfo> = {
    f32: scalar("f32"), i32: scalar("i32"), u32: scalar("u32"),
    vec2f: vec("f32", 2), vec3f: vec("f32", 3), vec4f: vec("f32", 4),
    vec2i: vec("i32", 2), vec3i: vec("i32", 3), vec4i: vec("i32", 4),
    vec2u: vec("u32", 2), vec3u: vec("u32", 3), vec4u: vec("u32", 4),
    mat2x2f: mat(2, 2), mat2x3f: mat(2, 3), mat2x4f: mat(2, 4),
    mat3x2f: mat(3, 2), mat3x3f: mat(3, 3), mat3x4f: mat(3, 4),
    mat4x2f: mat(4, 2), mat4x3f: mat(4, 3), mat4x4f: mat(4, 4),
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** WGSL forbids a lone underscore and identifiers that start with two. */
export function assertWgslIdentifier(what: string, name: string): void {
    if (!IDENTIFIER.test(name) || name === "_" || name.startsWith("__")) {
        throw new Error(`${what} "${name}" is not a valid WGSL identifier`);
    }
}

/** What the user declares for one field. */
export interface StructFieldSpec {
    name: string;
    type: StructFieldType;
}

/** A field with its position resolved. */
export interface FieldLayout {
    readonly name: string;
    readonly type: StructFieldType;
    /** Byte offset from the start of the struct. */
    readonly offset: number;
    readonly size: number;
    readonly alignment: number;
}

/**
 * The memory layout of a WGSL struct that lives in a uniform or storage buffer, computed from its field list with
 * the WGSL alignment rules instead of by hand: every field starts at the next multiple of its alignment, and the
 * struct's size is rounded up to the largest alignment among its fields.
 *
 * It is a description only (no GPU object). `toStruct()` gives the same shape the shader assemblers already take, so
 * the struct declaration in the generated WGSL and the bytes written on the CPU come from one source.
 */
export class StructLayout {
    readonly structName: string;
    readonly fields: readonly FieldLayout[];
    /** Size in bytes, rounded up to `alignment`. This is also the array stride when the struct is a storage array element. */
    readonly size: number;
    readonly alignment: number;
    private readonly byName = new Map<string, FieldLayout>();

    constructor(structName: string, specs: readonly StructFieldSpec[]) {
        assertWgslIdentifier("struct name", structName);
        if (specs.length === 0) throw new Error(`struct "${structName}" needs at least one field`);

        const fields: FieldLayout[] = [];
        let cursor = 0;
        let alignment = 1;

        for (const spec of specs) {
            assertWgslIdentifier(`field name in struct "${structName}"`, spec.name);
            if (this.byName.has(spec.name)) throw new Error(`struct "${structName}" has two fields named "${spec.name}"`);
            const info = TYPE_INFO[spec.type];
            if (!info) throw new Error(`struct "${structName}": field "${spec.name}" has unsupported type "${spec.type}"`);

            const offset = roundUp(info.align, cursor);
            const field: FieldLayout = {name: spec.name, type: spec.type, offset, size: info.size, alignment: info.align};
            fields.push(field);
            this.byName.set(spec.name, field);
            cursor = offset + info.size;
            alignment = Math.max(alignment, info.align);
        }

        this.structName = structName;
        this.fields = fields;
        this.alignment = alignment;
        this.size = roundUp(alignment, cursor);
    }

    getField(name: string): FieldLayout {
        const field = this.byName.get(name);
        if (!field) throw new Error(`struct "${this.structName}" has no field "${name}"`);
        return field;
    }

    /** The struct in the shape the shader assemblers take (see buildBindingDecls). */
    toStruct(): Struct {
        return {
            structName: this.structName,
            fields: this.fields.map((f) => ({name: f.name, type: f.type, offset: f.offset})),
        };
    }

    /**
     * Writes one field. `values` is tight and column-major (a mat3x3f takes 9 numbers): the padding between matrix
     * columns is skipped for you. Integers must be whole numbers inside their 32-bit range, floats must be finite.
     *
     * @param baseOffset where this struct starts inside the view, for arrays of structs
     */
    write(view: DataView, fieldName: string, values: ArrayLike<number>, baseOffset = 0): void {
        const field = this.getField(fieldName);
        const info = TYPE_INFO[field.type];
        const expected = info.columns * info.rows;
        if (values.length !== expected) {
            throw new Error(`${this.structName}.${fieldName} is a ${field.type}: expected ${expected} number(s), got ${values.length}`);
        }

        for (let c = 0; c < info.columns; c++) {
            for (let r = 0; r < info.rows; r++) {
                const value = values[c * info.rows + r];
                const at = baseOffset + field.offset + c * info.columnStride + r * 4;
                switch (info.scalar) {
                    case "f32":
                        if (!Number.isFinite(value)) throw new Error(`${this.structName}.${fieldName}: ${value} is not a finite float`);
                        view.setFloat32(at, value, true);
                        break;
                    case "i32":
                        if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
                            throw new Error(`${this.structName}.${fieldName}: ${value} is not an i32`);
                        }
                        view.setInt32(at, value, true);
                        break;
                    case "u32":
                        if (!Number.isInteger(value) || value < 0 || value > 4294967295) {
                            throw new Error(`${this.structName}.${fieldName}: ${value} is not a u32`);
                        }
                        view.setUint32(at, value, true);
                        break;
                }
            }
        }
    }
}
