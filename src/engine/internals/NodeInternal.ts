import {BindgroupRepresentation} from "../Representations/BindgroupRepresentation.ts";
import {PipelineRepresentation} from "../Representations/PipelineRepresentation.ts";
import {v4 as uuidv4} from "uuid";
import {NodeInternalHashProvider} from "../hashing/NodeInternalHashProvider.ts";
import type {MeshInternal} from "./MeshInternal.ts";

export class NodeInternal {
    private bindgroup = new BindgroupRepresentation();
    private pipeline = new PipelineRepresentation();
    private group: number
    readonly uuid: string
    private mesh: MeshInternal | null = null;
    readonly hashProvider: NodeInternalHashProvider;

    constructor(group: number = 2) {
        this.group = group;
        this.uuid = uuidv4()
        this.hashProvider = new NodeInternalHashProvider({
            getGroup: () => this.group,
            getBindgroup: () => this.bindgroup,
            getPipeline: () => this.pipeline,
            getMesh: () => this.mesh,
        });
    }

    getMesh() {
        return this.mesh
    }

    setMesh(mesh: MeshInternal | null) {
        this.mesh = mesh;
        this.hashProvider.markChanged();
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