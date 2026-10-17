import {v4 as uuidv4} from "uuid";
import type {BufferWrapper} from "../wrappers/BufferWrapper.ts";
import type {AttributeWrapper} from "../wrappers/AttributeWrapper.ts";
import {getVertexFormatSize, getWGSLTypeFromVertexFormat, type WGSLType} from "../producers/utils.ts";
import {toWgslIdentifier, type VertexInputField} from "../producers/AssemblerProducers.ts";
import {VertexLayoutSetHashProvider} from "../hashing/VertexLayoutSetHashProvider.ts";
import {assertWgslIdentifier} from "./StructLayout.ts";
import {toGpuVertexBufferLayouts} from "./describeVertexLayout.ts";

/** GPUBufferUsage.VERTEX, as a plain number so this file loads where no WebGPU exists (Node). */
const VERTEX_USAGE = 0x20;

/**
 * The WebGPU default limits (maxVertexBuffers, maxVertexAttributes, maxVertexBufferArrayStride). The renderer asks for
 * a default device, so these are what it gets; checking here puts the error next to the mistake instead of in a
 * pipeline validation message.
 */
const MAX_VERTEX_BUFFERS = 8;
const MAX_VERTEX_ATTRIBUTES = 16;
const MAX_ARRAY_STRIDE = 2048;

/** What the user declares for one attribute inside a vertex buffer. */
export interface VertexAttributeDesc {
    /**
     * The name this attribute has in generated WGSL and the name an assembler looks it up by. A shader-side concern
     * only: it is not part of the GPU layout hash. Defaults to `a<location>`.
     */
    name?: string;
    location: number;
    format: GPUVertexFormat;
    /** Byte offset of this attribute inside one vertex of its buffer. */
    offset: number;
}

/** What the user declares for one vertex buffer slot. */
export interface VertexBufferDesc {
    /** The index in `setVertexBuffer(slot, ...)`. Slots must end up as 0..n-1 without gaps. */
    slot: number;
    buffer: BufferWrapper;
    /** Bytes from the start of one vertex to the start of the next. A multiple of 4. */
    arrayStride: number;
    /** Defaults to "vertex". */
    stepMode?: GPUVertexStepMode;
    attributes: readonly VertexAttributeDesc[];
}

export interface VertexAttributeEntry {
    readonly name: string;
    readonly location: number;
    readonly format: GPUVertexFormat;
    readonly offset: number;
    readonly wgslType: WGSLType;
}

export interface VertexBufferEntry {
    readonly slot: number;
    readonly buffer: BufferWrapper;
    readonly arrayStride: number;
    readonly stepMode: GPUVertexStepMode;
    /** Sorted by location. */
    readonly attributes: readonly VertexAttributeEntry[];
}

/**
 * The vertex side of a primitive, declared explicitly: "this buffer, in this slot, with these attributes at these
 * locations, formats and offsets". It is the geometry counterpart of BindingSet and is used the same way: a built-in
 * geometry derives one from its attribute wrappers (`fromAttributes`), a user who wants full control declares one
 * directly, interleaved buffers included.
 *
 * Buffers change only through setBuffer / removeBuffer, so a change cannot go unseen.
 */
export class VertexLayoutSet {
    readonly uuid: string;
    readonly hashProvider: VertexLayoutSetHashProvider;

    private readonly buffers = new Map<number, VertexBufferEntry>();
    /** Sorted by slot. Rebuilt once per structural change, so hashing and codegen never sort. */
    private sorted: VertexBufferEntry[] = [];

    constructor(buffers: readonly VertexBufferDesc[] = []) {
        this.uuid = uuidv4();
        this.hashProvider = new VertexLayoutSetHashProvider(() => this.sorted);
        for (const desc of buffers) {
            // setBuffer replaces on purpose; in a declaration list the same slot twice is a mistake
            if (this.buffers.has(desc.slot)) throw new Error(`vertex buffer slot ${desc.slot} is declared twice`);
            this.putBuffer(desc);
        }
        this.hashProvider.markChangeStamp();
    }

    /**
     * The layout the engine uses today for a geometry: one buffer slot per attribute, attributes sorted by name,
     * the location equal to the slot, offset 0 and the format's own size as the stride. Names that are not valid WGSL
     * identifiers are sanitized the same way the shader producer does it.
     */
    static fromAttributes(attributes: Iterable<AttributeWrapper>): VertexLayoutSet {
        const sorted = [...attributes].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        return new VertexLayoutSet(sorted.map((attribute, i): VertexBufferDesc => ({
            slot: i,
            buffer: attribute,
            arrayStride: attribute.stride,
            stepMode: "vertex",
            attributes: [{name: toWgslIdentifier(attribute.name), location: i, format: attribute.format, offset: 0}],
        })));
    }

    /** Adds the buffer, or replaces the one in the same slot. */
    setBuffer(desc: VertexBufferDesc): void {
        this.putBuffer(desc);
        this.hashProvider.markChangeStamp();
    }

    removeBuffer(slot: number): void {
        if (!this.buffers.delete(slot)) return;
        this.resort();
        this.hashProvider.markChangeStamp();
    }

    getBuffer(slot: number): VertexBufferEntry | undefined {
        return this.buffers.get(slot);
    }

    /** Sorted by slot. The same array instance until the next structural change: do not mutate it. */
    getBuffers(): readonly VertexBufferEntry[] {
        return this.sorted;
    }

    getChangedAt(): number {
        return this.hashProvider.getChangedAt();
    }

    /** The `buffers` of the pipeline's vertex state. Throws if a slot is missing. */
    getVertexBufferLayouts(): GPUVertexBufferLayout[] {
        this.assertComplete();
        return toGpuVertexBufferLayouts(this.sorted);
    }

    /** The manager key of every buffer, by slot: the same key the buffer manager caches it under. */
    getResourceKeys(): {slot: number; key: string}[] {
        return this.sorted.map((b) => ({slot: b.slot, key: b.buffer.hashProvider.convertToHash()}));
    }

    /** The vertex inputs in the form the shader assemblers take, sorted by location. */
    getShaderInputs(): VertexInputField[] {
        return this.sorted
            .flatMap((b) => b.attributes)
            .sort((a, b) => a.location - b.location)
            .map((a) => ({name: a.name, id: a.name, type: a.wgslType, location: a.location}));
    }

    private assertComplete(): void {
        this.sorted.forEach((b, i) => {
            if (b.slot !== i) {
                throw new Error(`vertex buffer slots must be 0..${this.sorted.length - 1} without gaps: slot ${i} is missing (next is ${b.slot})`);
            }
        });
    }

    private putBuffer(desc: VertexBufferDesc): void {
        const {slot, buffer, arrayStride} = desc;
        const where = `vertex buffer slot ${slot}`;

        if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_VERTEX_BUFFERS) {
            throw new Error(`vertex buffer slot must be a whole number in 0..${MAX_VERTEX_BUFFERS - 1}, got ${slot}`);
        }
        if (!buffer || typeof buffer.getUsage !== "function" || (buffer.getUsage() & VERTEX_USAGE) === 0) {
            throw new Error(`${where}: the buffer needs VERTEX usage (use a VertexBufferWrapper or an AttributeWrapper)`);
        }
        if (!Number.isInteger(arrayStride) || arrayStride <= 0 || arrayStride % 4 !== 0 || arrayStride > MAX_ARRAY_STRIDE) {
            throw new Error(`${where}: arrayStride must be a positive multiple of 4 up to ${MAX_ARRAY_STRIDE}, got ${arrayStride}`);
        }
        const stepMode = desc.stepMode ?? "vertex";
        if (stepMode !== "vertex" && stepMode !== "instance") {
            throw new Error(`${where}: stepMode must be "vertex" or "instance", got "${stepMode}"`);
        }
        if (desc.attributes.length === 0) throw new Error(`${where}: a buffer needs at least one attribute`);

        // locations and names are unique across the whole set; the slot being replaced does not count against itself
        const locations = new Map<number, number>();
        const names = new Map<string, number>();
        for (const other of this.buffers.values()) {
            if (other.slot === slot) continue;
            for (const a of other.attributes) {
                locations.set(a.location, other.slot);
                names.set(a.name, other.slot);
            }
        }

        const attributes = desc.attributes.map((a): VertexAttributeEntry => {
            const {location, format, offset} = a;
            if (!Number.isInteger(location) || location < 0 || location >= MAX_VERTEX_ATTRIBUTES) {
                throw new Error(`${where}: location must be a whole number in 0..${MAX_VERTEX_ATTRIBUTES - 1}, got ${location}`);
            }

            let formatSize: number;
            let wgslType: WGSLType;
            try {
                formatSize = getVertexFormatSize(format);
                wgslType = getWGSLTypeFromVertexFormat(format);
            } catch {
                throw new Error(`${where} location ${location}: vertex format "${format}" is not supported by the engine`);
            }

            if (!Number.isInteger(offset) || offset < 0) {
                throw new Error(`${where} location ${location}: offset must be a whole number >= 0, got ${offset}`);
            }
            if (offset % Math.min(4, formatSize) !== 0) {
                throw new Error(`${where} location ${location}: offset ${offset} must be a multiple of ${Math.min(4, formatSize)} for ${format}`);
            }
            if (offset + formatSize > arrayStride) {
                throw new Error(`${where} location ${location}: ${format} at offset ${offset} needs ${offset + formatSize} bytes but arrayStride is ${arrayStride}`);
            }

            const name = a.name ?? `a${location}`;
            assertWgslIdentifier(`${where} location ${location}: name`, name);

            const locationOwner = locations.get(location);
            if (locationOwner !== undefined) {
                throw new Error(`location ${location} is used twice (slot ${locationOwner} and slot ${slot})`);
            }
            const nameOwner = names.get(name);
            if (nameOwner !== undefined) {
                throw new Error(`attribute name "${name}" is used twice (slot ${nameOwner} and slot ${slot})`);
            }
            locations.set(location, slot);
            names.set(name, slot);

            return {name, location, format, offset, wgslType};
        }).sort((x, y) => x.location - y.location);

        this.buffers.set(slot, {slot, buffer, arrayStride, stepMode, attributes});
        this.resort();
    }

    private resort(): void {
        this.sorted = Array.from(this.buffers.values()).sort((a, b) => a.slot - b.slot);
    }
}
