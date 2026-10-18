import type {PipelineLayoutRepresentation} from "./PipelineLayoutRepresentation.ts";
import {v4 as uuidv4} from "uuid";
import type {ShaderStageRepresentation} from "./ShaderStageRepresentation.ts";
import type {AttributeWrapper} from "../wrappers/AttributeWrapper.ts";

export type FrameTarget = {
    format: GPUTextureFormat
}
export type VertexBufferEntry = AttributeWrapper;


export class PipelineRepresentation {
    readonly uuid: string;
    private vertexBuffers: VertexBufferEntry[] = [];
    private fragmentTargets = new Map<number, FrameTarget>;
    private layout!: PipelineLayoutRepresentation;
    private vertexShader!: ShaderStageRepresentation
    private fragmentShader!: ShaderStageRepresentation
    private primitive!: GPUPrimitiveState
    private depthStencil!: GPUDepthStencilState

    constructor() {
        this.uuid = uuidv4();
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
    }

    setVertexShader(vertexShader: ShaderStageRepresentation) {
        this.vertexShader = vertexShader;
    }

    setFragmentShader(fragmentShader: ShaderStageRepresentation) {
        this.fragmentShader = fragmentShader;
    }

    setBuffers(buffers: VertexBufferEntry[]) {
        this.vertexBuffers = buffers;
    }

    setPrimitive(primitive: GPUPrimitiveState) {
        this.primitive = primitive;
    }

    setFragmentTarget(location: number, target: FrameTarget) {
        this.fragmentTargets.set(location, target);
    }

    removeFragmentTarget(location: number) {
        this.fragmentTargets.delete(location);
    }

    setDepthStencil(depthStencil: GPUDepthStencilState) {
        this.depthStencil = depthStencil;
    }
}