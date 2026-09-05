import type {GeometryWrapper} from "./GeometryWrapper.ts";
import type {MaterialWrapper} from "./MaterialWrapper.ts";
import {v4 as uuidv4} from "uuid";
import type {Hasher} from "../hashing/Hasher.ts";
import {BasicFragmentAssembler, BasicVertexAssembler} from "../Assemblers/BasicAssembler/BasicAssembler.ts";
import type {VertexAssemblerBase} from "../Assemblers/VertexShaderAssmblerBase.ts";
import type {FragmentAssemblerBase} from "../Assemblers/FragmentAssemblerBase.ts";
import {PipelineWrapper} from "./PipelineWrapper.ts";

export class PrimitiveWrapper {
    readonly uuid: string;

    private geometry!: GeometryWrapper;
    private material!: MaterialWrapper;

    private vertexAssembler: VertexAssemblerBase = new BasicVertexAssembler();
    private fragmentAssembler: FragmentAssemblerBase = new BasicFragmentAssembler();
    private pipelineWrapper = new PipelineWrapper();

    constructor() {
        this.uuid = uuidv4();
    }


    getPipeline() {
        return this.pipelineWrapper;
    }

    setVertexAssembler(a: VertexAssemblerBase): void {
        this.vertexAssembler = a;
    }

    getVertexAssembler(): VertexAssemblerBase {
        return this.vertexAssembler;
    }

    setFragmentAssembler(a: FragmentAssemblerBase): void {
        this.fragmentAssembler = a;
    }

    getFragmentAssembler(): FragmentAssemblerBase {
        return this.fragmentAssembler;
    }

    getGeometry(): GeometryWrapper {
        return this.geometry;
    }

    setGeometry(geometry: GeometryWrapper): void {
        this.geometry = geometry;
    }

    getMaterial(): MaterialWrapper {
        return this.material;
    }

    setMaterial(material: MaterialWrapper): void {
        this.material = material;
    }

    convertToHash(hasher: Hasher): string {
        return this.pipelineWrapper.computeHash(this.material, this.geometry, hasher)
    }
}