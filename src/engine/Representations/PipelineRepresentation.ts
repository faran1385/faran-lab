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
    private vertexBuffers = new Map<string, VertexBufferEntry>();
    private fragmentTargets = new Map<number, FrameTarget>;
    private layout!: PipelineLayoutRepresentation;
    private vertexShader!: ShaderStageRepresentation
    private fragmentShader!: ShaderStageRepresentation
    private primitive!: GPUPrimitiveState
    private depthStencil!: GPUDepthStencilState

    constructor() {
        this.uuid = uuidv4();
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

    setVertexBuffer(vertexBuffer: VertexBufferEntry) {
        this.vertexBuffers.set(vertexBuffer.uuid, vertexBuffer);
    }

    removeVertexBuffer(vertexBuffer: VertexBufferEntry) {
        this.vertexBuffers.delete(vertexBuffer.uuid);
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