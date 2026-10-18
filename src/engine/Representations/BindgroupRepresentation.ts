import {v4 as uuidv4} from "uuid";
import type {BindgroupLayoutRepresentation} from "./BindgroupLayoutRepresentation.ts";
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
    private layout!: BindgroupLayoutRepresentation;

    constructor() {
        this.uuid = uuidv4();
    }

    setLayout(layout: BindgroupLayoutRepresentation): void {
        this.layout = layout;
    }

    setEntry(binding: number, entry: BindgroupEntry): void {
        this.entries.set(binding, entry);
    }

    removeEntry(binding: number): void {
        this.entries.delete(binding);
    }
}