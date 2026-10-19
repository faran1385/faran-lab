import {PipelineLayoutRepresentation} from "./PipelineLayoutRepresentation.ts";
import {v4 as uuidv4} from "uuid";
import {PipelineRepresentationHashProvider} from "../hashing/PipelineRepresentationHashProvider.ts";
import type {BindgroupInteractor} from "./BindgroupInteractor.ts";

export type FrameTarget = {
    format: GPUTextureFormat,
    location: number
}

export class PipelineRepresentation {
    readonly uuid: string;
    readonly bindgroups = new Map<number, BindgroupInteractor>();
    private vertexBuffers: GPUVertexBufferLayout[] = [];
    private frameTargets = new Map<number, FrameTarget>;
    protected layout: PipelineLayoutRepresentation = new PipelineLayoutRepresentation();
    private vertexShader = {code: "", entryPoint: ""}
    private fragmentShader = {code: "", entryPoint: ""}
    private primitive!: GPUPrimitiveState
    private depthStencil!: GPUDepthStencilState

    readonly hashProvider: PipelineRepresentationHashProvider;

    constructor() {
        this.uuid = uuidv4();
        this.hashProvider = new PipelineRepresentationHashProvider({
            getVertexBuffers: () => this.vertexBuffers,
            getFragmentTargets: () => this.frameTargets,
            getLayout: () => this.layout,
            getVertexShader: () => this.vertexShader,
            getFragmentShader: () => this.fragmentShader,
            getPrimitive: () => this.primitive,
            getDepthStencil: () => this.depthStencil,
        });
    }

    protected getVertexBuffers() {
        return this.vertexBuffers;
    }

    protected getFragmentTargets() {
        return this.frameTargets;
    }


    protected getFragmentShader() {
        return this.fragmentShader;
    }

    protected getVertexShader() {
        return this.vertexShader;
    }

    protected getPrimitive() {
        return this.primitive;
    }

    protected getDepthStencil() {
        return this.depthStencil;
    }

    protected setVertexShader(vertexShader: PipelineRepresentation["vertexShader"]) {
        this.vertexShader = vertexShader;
        this.hashProvider.markChanged();
    }

    protected setFragmentShader(fragmentShader: PipelineRepresentation["fragmentShader"]) {
        this.fragmentShader = fragmentShader;
        this.hashProvider.markChanged();
    }

    protected setBuffers(buffers: GPUVertexBufferLayout[]) {
        this.vertexBuffers = buffers;
        this.hashProvider.markChanged();
    }

    protected setPrimitive(primitive: GPUPrimitiveState) {
        this.primitive = primitive;
        this.hashProvider.markChanged();
    }

    protected setFrameTarget(target: FrameTarget) {
        this.frameTargets.set(target.location, target);
        this.hashProvider.markChanged();
    }

    protected removeFrameTarget(location: number) {
        this.frameTargets.delete(location);
        this.hashProvider.markChanged();
    }

    protected clearFrameTargets() {
        this.frameTargets.clear();
        this.hashProvider.markChanged();
    }

    protected setDepthStencil(depthStencil: GPUDepthStencilState) {
        this.depthStencil = depthStencil;
        this.hashProvider.markChanged();
    }
}