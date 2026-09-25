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

    constructor(mat: MaterialWrapper, geo: GeometryWrapper) {
        this.uuid = uuidv4();

        this.geometry = geo;
        this.material = mat;
    }


    getPipeline() {
        return this.pipelineWrapper;
    }

    setVertexAssembler(a: VertexAssemblerBase): void {
        this.vertexAssembler = a;
        this.pipelineWrapper.markVertexShaderDirty()
    }

    getVertexAssembler(): VertexAssemblerBase {
        return this.vertexAssembler;
    }

    setFragmentAssembler(a: FragmentAssemblerBase): void {
        this.fragmentAssembler = a;
        this.pipelineWrapper.markFragmentShaderDirty()
    }

    getFragmentAssembler(): FragmentAssemblerBase {
        return this.fragmentAssembler;
    }

    getGeometry(): GeometryWrapper {
        return this.geometry;
    }

    setGeometry(geometry: GeometryWrapper): void {
        this.geometry = geometry;
        this.pipelineWrapper.markFragmentShaderDirty()
        this.pipelineWrapper.markVertexShaderDirty()
    }

    getMaterial(): MaterialWrapper {
        return this.material;
    }

    setMaterial(material: MaterialWrapper): void {
        this.material = material;
        this.pipelineWrapper.markFragmentShaderDirty()
        this.pipelineWrapper.markVertexShaderDirty()
    }
}