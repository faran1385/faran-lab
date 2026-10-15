import type {GeometryWrapper} from "./GeometryWrapper.ts";
import type {MaterialWrapper} from "./MaterialWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {BasicFragmentAssembler, BasicVertexAssembler} from "../Assemblers/BasicAssembler/BasicAssembler.ts";
import {PipelineWrapper} from "./PipelineWrapper.ts";
import {FragmentAssemblerBase, type VertexAssemblerBase} from "../Assemblers/BaseAssembler.ts";

export class PrimitiveWrapper {
    readonly uuid: string;

    private geometry: GeometryWrapper;
    private material: MaterialWrapper;

    private vertexAssembler: VertexAssemblerBase = new BasicVertexAssembler();
    private fragmentAssembler: FragmentAssemblerBase = new BasicFragmentAssembler();
    private pipelineWrapper = new PipelineWrapper();
    /** Separate generated shader/pipeline state for each skinning method used with this shared primitive. */
    private skinningPipelines = new Map<string, PipelineWrapper>();

    constructor(mat: MaterialWrapper, geo: GeometryWrapper) {
        this.uuid = uuidv4();

        this.geometry = geo;
        this.material = mat;
    }


    getPipeline(skinningId?: string): PipelineWrapper {
        if (!skinningId) return this.pipelineWrapper;
        let pipeline = this.skinningPipelines.get(skinningId);
        if (!pipeline) {
            pipeline = new PipelineWrapper();
            pipeline.markVertexShaderDirty();
            pipeline.markFragmentShaderDirty();
            this.skinningPipelines.set(skinningId, pipeline);
        }
        return pipeline;
    }

    private forEachPipeline(callback: (pipeline: PipelineWrapper) => void): void {
        callback(this.pipelineWrapper);
        for (const pipeline of this.skinningPipelines.values()) callback(pipeline);
    }

    /**
     * Latest change stamp of anything this primitive renders with. Swapping the material, geometry or an assembler
     * goes through the pipeline wrapper's mark*ShaderDirty(), so its stamp already covers those setters.
     */
    getChangedAt(skinningId?: string): number {
        return Math.max(
            this.material.hashProvider.getChangedAt(),
            this.geometry.hashProvider.getChangedAt(),
            this.getPipeline(skinningId).hashProvider.getChangedAt(),
        );
    }

    setVertexAssembler(a: VertexAssemblerBase): void {
        this.vertexAssembler = a;
        this.forEachPipeline((pipeline) => pipeline.markVertexShaderDirty())
    }

    getVertexAssembler(): VertexAssemblerBase {
        return this.vertexAssembler;
    }

    setFragmentAssembler(a: FragmentAssemblerBase): void {
        this.fragmentAssembler = a;
        this.forEachPipeline((pipeline) => pipeline.markFragmentShaderDirty())
    }

    getFragmentAssembler(): FragmentAssemblerBase {
        return this.fragmentAssembler;
    }

    getGeometry(): GeometryWrapper {
        return this.geometry;
    }

    setGeometry(geometry: GeometryWrapper): void {
        this.geometry = geometry;
        this.forEachPipeline((pipeline) => {
            pipeline.markFragmentShaderDirty();
            pipeline.markVertexShaderDirty();
        })
    }

    getMaterial(): MaterialWrapper {
        return this.material;
    }

    setMaterial(material: MaterialWrapper): void {
        this.material = material;
        this.forEachPipeline((pipeline) => {
            pipeline.markFragmentShaderDirty();
            pipeline.markVertexShaderDirty();
        })
    }
}