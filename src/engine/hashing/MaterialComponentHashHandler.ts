import {HashHandler} from "./HashHandler.ts";
import {AggregateHashHandler} from "./AggregateHashHandler.ts";
import {VersionFlag} from "./VersionFlag.ts";


export class MaterialComponentHashHandler {
    readonly shapeHash: HashHandler;
    readonly shaderKeyHash: HashHandler;
    readonly resourceHash: AggregateHashHandler;
    readonly factorVersionFlag = new VersionFlag();

    constructor(shapeHash: HashHandler, shaderKeyHash: HashHandler, resourceHash: AggregateHashHandler) {
        this.shapeHash = shapeHash;
        this.shaderKeyHash = shaderKeyHash;
        this.resourceHash = resourceHash;
    }
}