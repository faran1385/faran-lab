export type ResourceKind =
    | "buffer"
    | "texture"
    | "bindGroup"
    | "bindGroupLayout"
    | "sampler"
    | "pipeline"
    | "pipelineLayout"
    | "shaderModule";


export abstract class Tracker<T> {
    protected readonly resource: T;
    readonly kind: ResourceKind;
    refs = 0;
    deleteAtFrame = -1;

    constructor(resource: T, kind: ResourceKind) {
        this.resource = resource;
        this.kind = kind;
    }

    get raw(): T {
        return this.resource;
    }

    abstract destroy(): void;
}