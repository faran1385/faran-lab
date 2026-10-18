import {BindgroupRepresentation} from "../Representations/BindgroupRepresentation.ts";
import {PipelineRepresentation} from "../Representations/PipelineRepresentation.ts";

export class NodeInternal {
    private bindgroup = new BindgroupRepresentation();
    private pipeline = new PipelineRepresentation();

    private group: number

    constructor(group: number = 2) {
        this.group = group;
    }

    getBindgroup() {
        return this.bindgroup;
    }

    getPipeline() {
        return this.pipeline;
    }

    getGroup() {
        return this.group;
    }
}