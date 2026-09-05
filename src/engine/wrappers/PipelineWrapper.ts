import {v4 as uuidv4} from "uuid";
import type {Hasher} from "../hashing/Hasher.ts";
import {VertexShaderWrapper} from "./VertexShaderWrapper.ts";
import {FragmentShaderWrapper} from "./FragmentShaderWrapper.ts";
import type {MaterialWrapper} from "./MaterialWrapper.ts";
import type {GeometryWrapper} from "./GeometryWrapper.ts";
import {PipelineHashHandler} from "../hashing/PipelineHashHandler.ts";

export type PrimitiveTopology =
    | "point-list"
    | "line-list"
    | "line-strip"
    | "triangle-list"
    | "triangle-strip";

export type AlphaMode = "OPAQUE" | "MASK" | "BLEND";

export class PipelineWrapper {
    private vertexShaderWrapper: VertexShaderWrapper = new VertexShaderWrapper();
    private fragmentShaderWrapper: FragmentShaderWrapper = new FragmentShaderWrapper();

    private topology: PrimitiveTopology = "triangle-list";
    private alphaMode: AlphaMode = "OPAQUE";
    private alphaCutoff: number = 0.5;
    private doubleSided: boolean = false;
    private targetFormat: GPUTextureFormat = "bgra8unorm";
    private sampleCount: number = 1;

    readonly uuid: string;

    private hashHandler: PipelineHashHandler;

    constructor() {
        this.uuid = uuidv4();
        this.hashHandler = new PipelineHashHandler(
            () => this.vertexShaderWrapper,
            () => this.fragmentShaderWrapper,
            () => this.settingsKey(),
        );
    }

    setVertexShaderWrapper(vertexShaderWrapper: VertexShaderWrapper): void {
        this.vertexShaderWrapper = vertexShaderWrapper;
    }

    setFragmentShaderWrapper(fragmentShaderWrapper: FragmentShaderWrapper): void {
        this.fragmentShaderWrapper = fragmentShaderWrapper;
    }

    setTopology(topology: PrimitiveTopology): void {
        this.topology = topology;
    }

    setAlphaMode(alphaMode: AlphaMode): void {
        this.alphaMode = alphaMode;
    }

    setAlphaCutoff(alphaCutoff: number): void {
        this.alphaCutoff = alphaCutoff;
    }

    setDoubleSided(doubleSided: boolean): void {
        this.doubleSided = doubleSided;
    }

    setTargetFormat(targetFormat: GPUTextureFormat): void {
        this.targetFormat = targetFormat;
    }

    setSampleCount(sampleCount: number): void {
        this.sampleCount = sampleCount;
    }

    getVertexShaderWrapper(): VertexShaderWrapper | null {
        return this.vertexShaderWrapper;
    }

    getFragmentShaderWrapper(): FragmentShaderWrapper | null {
        return this.fragmentShaderWrapper;
    }

    getTopology(): PrimitiveTopology {
        return this.topology;
    }

    getAlphaMode(): AlphaMode {
        return this.alphaMode;
    }

    getAlphaCutoff(): number {
        return this.alphaCutoff;
    }

    getDoubleSided(): boolean {
        return this.doubleSided;
    }

    getTargetFormat(): GPUTextureFormat {
        return this.targetFormat;
    }

    getSampleCount(): number {
        return this.sampleCount;
    }

    computeHash(material: MaterialWrapper, geometry: GeometryWrapper, hasher: Hasher): string {
        return this.hashHandler.computeHash(material, geometry, hasher);
    }

    drainTrash(): string[] {
        return this.hashHandler.drainTrash();
    }

    private settingsKey(): string {
        return `${this.topology}|${this.alphaMode}|${this.alphaCutoff}|${this.doubleSided}|${this.targetFormat}|${this.sampleCount}`;
    }
}