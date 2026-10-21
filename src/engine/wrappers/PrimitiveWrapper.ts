import type {GeometryWrapper} from "./GeometryWrapper.ts";
import type {MaterialWrapper} from "./MaterialWrapper.ts";
import {v4 as uuidv4} from "uuid";
import {BasicFragmentAssembler, BasicVertexAssembler} from "../Assemblers/BasicAssembler/BasicAssembler.ts";
import {FragmentAssemblerBase, type VertexAssemblerBase} from "../Assemblers/BaseAssembler.ts";
import {PrimitiveAdaptor} from "../Adaptors/PrimitiveAdaptor.ts";

export class PrimitiveWrapper {
    readonly uuid: string;
    readonly adaptor = new PrimitiveAdaptor();

    private geometry: GeometryWrapper;
    private material: MaterialWrapper;

    private vertexAssembler: VertexAssemblerBase;
    private fragmentAssembler: FragmentAssemblerBase;

    constructor(
        mat: MaterialWrapper,
        geo: GeometryWrapper,
        vertexAssembler?: VertexAssemblerBase,
        fragmentAssembler?: FragmentAssemblerBase
    ) {
        this.uuid = uuidv4();

        this.vertexAssembler = vertexAssembler ?? new BasicVertexAssembler();
        this.fragmentAssembler = fragmentAssembler ?? new BasicFragmentAssembler();

        this.adaptor.setAssemblers(this.vertexAssembler, this.fragmentAssembler);
        this.adaptor.setMaterial(mat);
        this.adaptor.setGeometry(geo);
        this.geometry = geo;
        this.material = mat;
    }

    setVertexAssembler(assembler: VertexAssemblerBase): void {
        this.vertexAssembler = assembler;
        this.adaptor.setVertexAssembler(assembler);
    }

    setFragmentAssembler(assembler: FragmentAssemblerBase): void {
        this.fragmentAssembler = assembler;
        this.adaptor.setFragmentAssembler(assembler);
    }

    getVertexAssembler(): VertexAssemblerBase {
        return this.vertexAssembler;
    }

    getFragmentAssembler(): FragmentAssemblerBase {
        return this.fragmentAssembler;
    }

    getGeometry(): GeometryWrapper {
        return this.geometry;
    }

    setGeometry(geometry: GeometryWrapper): void {
        this.geometry = geometry;
        this.adaptor.setGeometry(geometry);
    }

    getMaterial(): MaterialWrapper {
        return this.material;
    }

    setMaterial(material: MaterialWrapper): void {
        this.material = material;
        this.adaptor.setMaterial(material);
    }
}