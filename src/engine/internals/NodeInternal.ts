import {v4 as uuidv4} from "uuid";
import {NodeInternalHashProvider} from "../hashing/NodeInternalHashProvider.ts";
import type {MeshInternal} from "./MeshInternal.ts";
import {BindgroupInteractor} from "../Representations/BindgroupInteractor.ts";
import {PipelineInteractor, type PipelineFrame} from "../Representations/PipelineInteractor.ts";

export class NodeInternal {
    readonly bindgroupInteractor = new BindgroupInteractor();
    readonly nodeBindgroupAt: null | number = null;
    readonly uuid: string;
    private mesh: MeshInternal | null = null;
    /**
     * Keyed by primitive uuid. The value is an array because one primitive can need several pipelines (a double-sided
     * blended material draws two cull variants) and, later, skinning can change the node's layout.
     */
    private pipelines = new Map<string, PipelineInteractor[]>();
    private frame: PipelineFrame | null = null;
    private sceneBindgroup: BindgroupInteractor | null = null
    readonly sceneBindgroupAt: null | number = null;
    readonly hashProvider: NodeInternalHashProvider;

    constructor(nodeBindgroupAt: number | null = null, sceneBindgroupAt: number | null = null) {
        this.sceneBindgroupAt = sceneBindgroupAt;
        this.nodeBindgroupAt = nodeBindgroupAt;

        this.uuid = uuidv4();
        this.hashProvider = new NodeInternalHashProvider({
            getGroup: () => this.nodeBindgroupAt,
            getBindgroup: () => this.bindgroupInteractor,
            getPipelines: () => this.pipelines,
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

    getPipelines() {
        return this.pipelines;
    }

    setPipelines(primitiveUuid: string, pipelines: PipelineInteractor[]) {
        this.pipelines.set(primitiveUuid, pipelines);
        this.hashProvider.markChanged();
    }

    removePipelines(primitiveUuid: string) {
        if (this.pipelines.delete(primitiveUuid)) this.hashProvider.markChanged();
    }

    getFrame() {
        return this.frame;
    }

    /** Render-side input: target formats. Applied to every pipeline of this node, and to pipelines created later. */
    setFrame(frame: PipelineFrame) {
        if (this.frame?.colorFormat === frame.colorFormat && this.frame.depthFormat === frame.depthFormat) return;
        this.frame = frame;
        for (const list of this.pipelines.values()) for (const pipeline of list) pipeline.setFrame(frame);
        this.hashProvider.markChanged();
    }

    getSceneBindgroup() {
        return this.sceneBindgroup;
    }

    setSceneBindgroup(bindgroup: BindgroupInteractor) {
        if (this.sceneBindgroup === bindgroup) return;
        this.sceneBindgroup = bindgroup;
    }
}
