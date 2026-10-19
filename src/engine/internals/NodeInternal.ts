import {PipelineRepresentation} from "../Representations/PipelineRepresentation.ts";
import {v4 as uuidv4} from "uuid";
import {NodeInternalHashProvider} from "../hashing/NodeInternalHashProvider.ts";
import type {MeshInternal} from "./MeshInternal.ts";
import {BindgroupInteractor} from "../Representations/BindgroupInteractor.ts";

export class NodeInternal {
    private bindgroupInteractor = new BindgroupInteractor();
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
            getBindgroup: () => this.bindgroupInteractor.bindgroup,
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

    getBindgroupInteractor() {
        return this.bindgroupInteractor;
    }

    getPipeline() {
        return this.pipeline;
    }

    getGroup() {
        return this.group;
    }
}