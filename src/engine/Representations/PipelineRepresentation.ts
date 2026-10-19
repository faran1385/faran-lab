import type {PipelineLayoutRepresentation} from "./PipelineLayoutRepresentation.ts";
import {v4 as uuidv4} from "uuid";
import {PipelineRepresentationHashProvider} from "../hashing/PipelineRepresentationHashProvider.ts";
import type {ShaderStageRepresentation} from "./ShaderStageRepresentation.ts";

export type FrameTarget = {
    format: GPUTextureFormat
}

export class PipelineRepresentation {
    readonly uuid: string;
    private vertexBuffers: GPUVertexBufferLayout[] = [];
    private fragmentTargets = new Map<number, FrameTarget>;
    private layout!: PipelineLayoutRepresentation;
    private vertexShader!: ShaderStageRepresentation
    private fragmentShader!: ShaderStageRepresentation
    private primitive!: GPUPrimitiveState
    private depthStencil!: GPUDepthStencilState

    readonly hashProvider: PipelineRepresentationHashProvider;

    constructor() {
        this.uuid = uuidv4();
        this.hashProvider = new PipelineRepresentationHashProvider({
            getVertexBuffers: () => this.vertexBuffers,
            getFragmentTargets: () => this.fragmentTargets,
            getLayout: () => this.layout,
            getVertexShader: () => this.vertexShader,
            getFragmentShader: () => this.fragmentShader,
            getPrimitive: () => this.primitive,
            getDepthStencil: () => this.depthStencil,
        });
    }

    getVertexBuffers() {
        return this.vertexBuffers;
    }

    getFragmentTargets() {
        return this.fragmentTargets;
    }

    getLayout() {
        return this.layout;
    }

    getFragmentShader() {
        return this.fragmentShader;
    }

    getVertexShader() {
        return this.vertexShader;
    }

    getPrimitive() {
        return this.primitive;
    }

    getDepthStencil() {
        return this.depthStencil;
    }


    setLayout(layout: PipelineLayoutRepresentation) {
        this.layout = layout;
        this.hashProvider.markChanged();
    }

    setVertexShader(vertexShader: ShaderStageRepresentation) {
        this.vertexShader = vertexShader;
        this.hashProvider.markChanged();
    }

    setFragmentShader(fragmentShader: ShaderStageRepresentation) {
        this.fragmentShader = fragmentShader;
        this.hashProvider.markChanged();
    }

    setBuffers(buffers: GPUVertexBufferLayout[]) {
        this.vertexBuffers = buffers;
        this.hashProvider.markChanged();
    }

    setPrimitive(primitive: GPUPrimitiveState) {
        this.primitive = primitive;
        this.hashProvider.markChanged();
    }

    setFragmentTarget(location: number, target: FrameTarget) {
        this.fragmentTargets.set(location, target);
        this.hashProvider.markChanged();
    }

    removeFragmentTarget(location: number) {
        this.fragmentTargets.delete(location);
        this.hashProvider.markChanged();
    }

    setDepthStencil(depthStencil: GPUDepthStencilState) {
        this.depthStencil = depthStencil;
        this.hashProvider.markChanged();
    }
}