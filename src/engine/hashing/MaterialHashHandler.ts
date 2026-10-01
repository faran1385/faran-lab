import {HashHandler} from "./HashHandler.ts";
import {AggregateHashHandler} from "./AggregateHashHandler.ts";

export class MaterialHashHandler {
    readonly pipelineSettingsHash: HashHandler;
    readonly shaderHash: AggregateHashHandler;
    readonly bindgroupHash: AggregateHashHandler;
    readonly factorsHash: AggregateHashHandler;


    constructor(
        pipelineSettingsHash: HashHandler,
        factorsHash: AggregateHashHandler,
        shaderHash: AggregateHashHandler,
        bindgroupHash: AggregateHashHandler
    ) {
        this.pipelineSettingsHash = pipelineSettingsHash;
        this.shaderHash = shaderHash;
        this.bindgroupHash = bindgroupHash;
        this.factorsHash = factorsHash;
    }

}