import { v4 as uuidv4 } from "uuid";
import { NodeInternalHashProvider } from "../hashing/NodeInternalHashProvider.ts";
import type { MeshInternal } from "./MeshInternal.ts";
import { BindgroupInteractor } from "../Representations/BindgroupInteractor.ts";
import { PipelineInteractor } from "../Representations/PipelineInteractor.ts";

export class NodeInternal {
    readonly bindgroupInteractor = new BindgroupInteractor();
    readonly pipeline = new PipelineInteractor();
    private group: number;
    readonly uuid: string;
    private mesh: MeshInternal | null = null;
    readonly hashProvider: NodeInternalHashProvider;

    constructor(group: number = 2) {
        this.group = group;
        this.uuid = uuidv4();
        this.hashProvider = new NodeInternalHashProvider({
            getGroup: () => this.group,
            getBindgroup: () => this.bindgroupInteractor,
            getPipeline: () => this.pipeline,
            getMesh: () => this.mesh,
        });
    }

    getMesh() {
        return this.mesh;
    }

    setMesh(mesh: MeshInternal | null) {
        if (this.mesh === mesh) return;
        this.mesh = mesh;
        this.hashProvider.markChanged();
    }

    getPipeline() {
        return this.pipeline;
    }

    getGroup() {
        return this.group;
    }
}
