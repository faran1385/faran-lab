import type {BindgroupLayoutRepresentation} from "./BindgroupLayoutRepresentation.ts";
import {v4 as uuidv4} from "uuid";
import {PipelineLayoutRepresentationHashProvider} from "../hashing/PipelineLayoutRepresentationHashProvider.ts";

export class PipelineLayoutRepresentation {
    readonly uuid: string;
    private layouts = new Map<number, BindgroupLayoutRepresentation>()
    readonly hashProvider: PipelineLayoutRepresentationHashProvider;

    constructor() {
        this.uuid = uuidv4();
        this.hashProvider = new PipelineLayoutRepresentationHashProvider({getLayouts: () => this.layouts});
    }

    getLayouts(): ReadonlyMap<number, BindgroupLayoutRepresentation> {
        return this.layouts;
    }

    clearLayouts(): void {
        this.layouts.clear();
        this.hashProvider.markChanged();
    }

    setLayout(group: number, layout: BindgroupLayoutRepresentation): void {
        this.layouts.set(group, layout);
        this.hashProvider.markChanged();
    }

    removeLayout(group: number): void {
        this.layouts.delete(group);
        this.hashProvider.markChanged();
    }
}