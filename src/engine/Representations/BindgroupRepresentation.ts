import {v4 as uuidv4} from "uuid";
import {BindgroupLayoutRepresentation} from "./BindgroupLayoutRepresentation.ts";
import {BindgroupRepresentationHashProvider} from "../hashing/BindgroupRepresentationHashProvider.ts";
import type {BufferWrapper} from "../wrappers/BufferWrapper.ts";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";


export type BindgroupEntry = {
    binding: number,
    resource: BufferWrapper | SamplerWrapper | ImageWrapper
}

export class BindgroupRepresentation {
    readonly uuid: string;
    private entries = new Map<number, BindgroupEntry>()
    private layout = new BindgroupLayoutRepresentation();
    readonly hashProvider: BindgroupRepresentationHashProvider;

    constructor() {
        this.uuid = uuidv4();
        this.hashProvider = new BindgroupRepresentationHashProvider({
            getEntries: () => this.entries,
            getLayout: () => this.layout,
        });
    }

    getLayout() {
        return this.layout
    }

    setEntry(binding: number, entry: BindgroupEntry): void {
        this.entries.set(binding, entry);
        this.hashProvider.markChanged();
    }

    removeEntry(binding: number): void {
        this.entries.delete(binding);
        this.hashProvider.markChanged();
    }
}