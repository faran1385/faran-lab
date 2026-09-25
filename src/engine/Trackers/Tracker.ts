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


    constructor(resource: T, kind: ResourceKind) {
        this.resource = resource;
        this.kind = kind;
    }

    get raw(): T {
        return this.resource;
    }
}