import {BindgroupRepresentation} from "../Representations/BindgroupRepresentation.ts";
import {PipelineRepresentation} from "../Representations/PipelineRepresentation.ts";
import {v4 as uuidv4} from "uuid";
import type {MeshInternal} from "./MeshInternal.ts";

export class NodeInternal {
    private bindgroup = new BindgroupRepresentation();
    private pipeline = new PipelineRepresentation();
    private group: number
    readonly uuid: string
    private mesh: MeshInternal | null = null;

    constructor(group: number = 2) {
        this.group = group;
        this.uuid = uuidv4()
    }

    getMesh() {
        return this.mesh
    }

    setMesh(mesh: MeshInternal | null) {
        this.mesh = mesh;
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