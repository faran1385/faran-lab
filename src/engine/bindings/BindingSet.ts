import {v4 as uuidv4} from "uuid";
import type {BindableWrapper} from "./BindableWrappers.ts";
import {ALL_SHADER_STAGES, type ShaderStageFlags} from "./ShaderStage.ts";
import {assertWgslIdentifier} from "./StructLayout.ts";
import {describeLayoutEntry, resourceKeysOf, textureSampleTypeOf, wgslTextureTypeOf, type ResourceKey} from "./describeBinding.ts";
import {BindingSetHashProvider} from "../hashing/BindingSetHashProvider.ts";
import type {Hasher} from "../hashing/utils/Hasher.ts";
import type {BindGroupEntry} from "../producers/AssemblerProducers.ts";
import {buildBindingDecls} from "../Assemblers/utils.ts";

/** What the user declares for one binding. */
export interface BindingEntryDesc {
    binding: number;
    value: BindableWrapper;
    visibility: ShaderStageFlags;
    /**
     * The name this binding has in generated WGSL and the name an assembler looks it up by. A shader-side concern
     * only: it is not part of any hash. Defaults to `b<binding>`.
     */
    name?: string;
}

export interface BindingEntry {
    readonly binding: number;
    readonly value: BindableWrapper;
    readonly visibility: ShaderStageFlags;
    readonly name: string;
}

/**
 * One bind group, declared explicitly: "this resource, at this binding, visible to these stages".
 *
 * This is the layer everything else is built on. A built-in material or node fills one from its own data; a user who
 * wants full control fills one directly. Either way the same code turns it into a layout, a bind group, cache keys
 * and (optionally) the matching WGSL declarations.
 *
 * Entries change only through setEntry / removeEntry, so a change cannot go unseen. A BindingSet may be shared by
 * several owners: it is identified by what is in it, and its resources are shared the same way.
 */
export class BindingSet {
    readonly uuid: string;
    /** The @group index this set is bound as. Part of the shader declarations and of the pipeline layout slot, not of the layout hash. */
    readonly group: number;
    readonly hashProvider: BindingSetHashProvider;

    private readonly entries = new Map<number, BindingEntry>();
    /** Sorted by binding. Rebuilt once per structural change, so hashing and codegen never sort. */
    private sorted: BindingEntry[] = [];

    constructor(group: number, entries: readonly BindingEntryDesc[] = []) {
        if (!Number.isInteger(group) || group < 0) throw new Error(`bind group index must be a whole number >= 0, got ${group}`);
        this.uuid = uuidv4();
        this.group = group;
        this.hashProvider = new BindingSetHashProvider(() => this.sorted);
        for (const desc of entries) {
            // setEntry replaces on purpose; in a declaration list the same index twice is a mistake
            if (this.entries.has(desc.binding)) throw new Error(`group ${group}: binding ${desc.binding} is declared twice`);
            this.putEntry(desc);
        }
        this.hashProvider.markChangeStamp();
    }

    /** Adds the entry, or replaces the one at the same binding index (swap a resource, change its stages). */
    setEntry(desc: BindingEntryDesc): void {
        this.putEntry(desc);
        this.hashProvider.markChangeStamp();
    }

    removeEntry(binding: number): void {
        if (!this.entries.delete(binding)) return;
        this.resort();
        this.hashProvider.markChangeStamp();
    }

    getEntry(binding: number): BindingEntry | undefined {
        return this.entries.get(binding);
    }

    getEntryByName(name: string): BindingEntry | undefined {
        return this.sorted.find((entry) => entry.name === name);
    }

    /** Sorted by binding. The same array instance until the next structural change: do not mutate it. */
    getEntries(): readonly BindingEntry[] {
        return this.sorted;
    }

    getChangedAt(): number {
        return this.hashProvider.getChangedAt();
    }

    /** The layout descriptor for the GPU. Entries are in binding order. */
    getLayoutDescriptor(): GPUBindGroupLayoutDescriptor {
        return {label: this.uuid, entries: this.sorted.map(describeLayoutEntry)};
    }

    /** The manager keys of every resource in the set, in binding order. */
    getResourceKeys(hasher: Hasher): ResourceKey[] {
        return resourceKeysOf(this.sorted, hasher);
    }

    /**
     * The entries in the form the shader assemblers take. This needs enough information to write a declaration, so a
     * buffer without a struct description throws: either describe it, or leave this set out of generated code and
     * declare it in your own WGSL.
     */
    getShaderBindings(): BindGroupEntry[] {
        return this.sorted.map((entry): BindGroupEntry => {
            const {binding, name, value} = entry;
            const group = this.group;
            switch (value.bindingKind) {
                case "uniform-buffer":
                    if (!value.struct) throw this.undescribed(entry, "uniform buffer", "a struct");
                    return {kind: "uniform", group, binding, name, struct: value.struct.toStruct(), size: value.struct.size};
                case "read-only-storage-buffer":
                    if (!value.element) throw this.undescribed(entry, "storage buffer", "an element struct");
                    return {kind: "storage", group, binding, name, struct: value.element.toStruct(), access: "read"};
                case "texture-2d":
                    return {
                        kind: "texture", group, binding, name,
                        textureType: wgslTextureTypeOf(textureSampleTypeOf(value.getFormat())),
                    };
                case "sampler":
                    return {kind: "sampler", group, binding, name, samplerType: "sampler"};
            }
        });
    }

    /**
     * The WGSL declarations for this set (structs and `@group/@binding` variables), generated from the same entries
     * the layout is built from, so the shader and the layout cannot disagree about a binding.
     */
    getShaderPrelude(): string {
        return buildBindingDecls(this.getShaderBindings()).bindingCode;
    }

    private undescribed(entry: BindingEntry, what: string, needs: string): Error {
        return new Error(
            `group ${this.group} binding ${entry.binding} ("${entry.name}") is a ${what} without ${needs}, so no WGSL can be generated for it. ` +
            `Give it a description, or declare it in your own shader.`,
        );
    }

    private putEntry(desc: BindingEntryDesc): void {
        const {binding, value, visibility} = desc;
        if (!Number.isInteger(binding) || binding < 0) throw new Error(`binding index must be a whole number >= 0, got ${binding}`);
        if (!Number.isInteger(visibility) || visibility <= 0 || (visibility & ~ALL_SHADER_STAGES) !== 0) {
            throw new Error(`group ${this.group} binding ${binding}: visibility must combine ShaderStage flags, got ${visibility}`);
        }
        if (!value || typeof value.bindingKind !== "string") {
            throw new Error(`group ${this.group} binding ${binding}: the value is not a bindable wrapper`);
        }

        const name = desc.name ?? `b${binding}`;
        assertWgslIdentifier(`group ${this.group} binding ${binding}: name`, name);
        for (const other of this.entries.values()) {
            if (other.binding !== binding && other.name === name) {
                throw new Error(`group ${this.group}: bindings ${other.binding} and ${binding} are both named "${name}"`);
            }
        }

        this.entries.set(binding, {binding, value, visibility, name});
        this.resort();
    }

    private resort(): void {
        this.sorted = Array.from(this.entries.values()).sort((a, b) => a.binding - b.binding);
    }
}
