import type {BindgroupLayoutRepresentation} from "./BindgroupLayoutRepresentation.ts";
import {v4 as uuidv4} from "uuid";

export class PipelineLayoutRepresentation {
    readonly uuid: string;
    private layouts = new Map<number, BindgroupLayoutRepresentation>()

    constructor() {
        this.uuid = uuidv4();
    }

    setLayout(group: number, layout: BindgroupLayoutRepresentation): void {
        this.layouts.set(group, layout);
    }

    removeLayout(group: number): void {
        this.layouts.delete(group);
    }
}