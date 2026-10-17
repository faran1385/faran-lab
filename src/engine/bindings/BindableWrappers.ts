import {BufferWrapper} from "../wrappers/BufferWrapper.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";
import type {StructLayout} from "./StructLayout.ts";

/**
 * Everything that can sit in a bind group entry. Each member carries a `bindingKind` that is fixed by its class, so
 * the binding layer never has to guess what a resource is: the class says it.
 *
 * ImageWrapper is the 2D texture handle and SamplerWrapper the sampler handle; the two buffer wrappers below are the
 * uniform and the read-only storage handle.
 */
export type BindableWrapper = UniformBufferWrapper | ReadOnlyStorageBufferWrapper | ImageWrapper | SamplerWrapper;

export type BindingKind = BindableWrapper["bindingKind"];

function assertByteSize(byteSize: number): void {
    if (!Number.isInteger(byteSize) || byteSize <= 0) {
        throw new Error(`a buffer needs a positive whole byteSize, got ${byteSize}`);
    }
}

/**
 * How a uniform buffer gets its bytes. Describing a struct is optional: with one, the engine can declare the struct in
 * WGSL for you and you can write fields by name; with raw bytes, you declare it in your own shader.
 */
export type UniformBufferSource =
    | { byteSize: number }
    | { data: ArrayBuffer }
    | { struct: StructLayout };

/** The buffer holds `count` elements, each laid out like `element` (the WGSL array stride equals `element.size`). */
export type StorageBufferSource =
    | { byteSize: number }
    | { data: ArrayBuffer }
    | { element: StructLayout; count: number };

/** A buffer bound as `var<uniform>`. Its GPU buffer is keyed by identity (uuid): two wrappers never share bytes. */
export class UniformBufferWrapper extends BufferWrapper {
    readonly bindingKind = "uniform-buffer" as const;
    /** Present when the buffer was created from a struct description. */
    readonly struct?: StructLayout;

    constructor(source: UniformBufferSource) {
        super(UniformBufferWrapper.dataOf(source), GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        this.struct = "struct" in source ? source.struct : undefined;
    }

    private static dataOf(source: UniformBufferSource): ArrayBuffer {
        if ("struct" in source) return new ArrayBuffer(source.struct.size);
        if ("data" in source) return source.data;
        assertByteSize(source.byteSize);
        return new ArrayBuffer(source.byteSize);
    }

    /** Writes one field of the described struct. Contents change only: nothing about layouts or bind groups does. */
    setField(name: string, values: ArrayLike<number>): void {
        if (!this.struct) throw new Error("UniformBufferWrapper.setField needs a struct description; this buffer holds raw bytes");
        this.struct.write(new DataView(this.data), name, values);
        this.hashProvider.markNeedsUpdate();
        this.hashProvider.markChangeStamp();
    }

    override setData(data: ArrayBuffer): void {
        if (this.struct && data.byteLength !== this.struct.size) {
            throw new Error(`struct "${this.struct.structName}" is ${this.struct.size} bytes, got ${data.byteLength}`);
        }
        super.setData(data);
    }
}

/** A buffer bound as `var<storage, read>`. Identity-keyed like UniformBufferWrapper. */
export class ReadOnlyStorageBufferWrapper extends BufferWrapper {
    readonly bindingKind = "read-only-storage-buffer" as const;
    /** Present when the buffer was created from an element description. */
    readonly element?: StructLayout;
    readonly count?: number;

    constructor(source: StorageBufferSource) {
        super(ReadOnlyStorageBufferWrapper.dataOf(source), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        if ("element" in source) {
            this.element = source.element;
            this.count = source.count;
        }
    }

    private static dataOf(source: StorageBufferSource): ArrayBuffer {
        if ("element" in source) {
            if (!Number.isInteger(source.count) || source.count <= 0) {
                throw new Error(`a storage array needs a positive whole count, got ${source.count}`);
            }
            return new ArrayBuffer(source.element.size * source.count);
        }
        if ("data" in source) return source.data;
        assertByteSize(source.byteSize);
        return new ArrayBuffer(source.byteSize);
    }

    /** Writes one field of one array element. */
    setElementField(index: number, name: string, values: ArrayLike<number>): void {
        if (!this.element || this.count === undefined) {
            throw new Error("ReadOnlyStorageBufferWrapper.setElementField needs an element description; this buffer holds raw bytes");
        }
        if (!Number.isInteger(index) || index < 0 || index >= this.count) {
            throw new Error(`element ${index} is outside the array (${this.count} elements)`);
        }
        this.element.write(new DataView(this.data), name, values, index * this.element.size);
        this.hashProvider.markNeedsUpdate();
        this.hashProvider.markChangeStamp();
    }

    override setData(data: ArrayBuffer): void {
        if (this.element && data.byteLength !== this.element.size * this.count!) {
            throw new Error(`the array is ${this.element.size * this.count!} bytes, got ${data.byteLength}`);
        }
        super.setData(data);
    }
}
