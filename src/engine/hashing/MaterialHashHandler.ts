import {HashHandler} from "./HashHandler.ts";
import {AggregateHashHandler} from "./AggregateHashHandler.ts";
import type {TriggerableAggregateHashHandler} from "./TriggerableAggregateHashHandler.ts";

export class MaterialHashHandler {
    readonly pipelineSettingsHash: HashHandler;
    readonly shaderHash: TriggerableAggregateHashHandler;
    readonly bindgroupLayoutHash: AggregateHashHandler;
    readonly bindgroupHash: AggregateHashHandler;
    readonly factorsHash: AggregateHashHandler;


    constructor(
        pipelineSettingsHash: HashHandler,
        factorsHash: AggregateHashHandler,
        shaderHash: TriggerableAggregateHashHandler,
        bindgroupLayoutHash: AggregateHashHandler,
        bindgroupHash: AggregateHashHandler
    ) {
        this.pipelineSettingsHash = pipelineSettingsHash;
        this.shaderHash = shaderHash;
        this.bindgroupLayoutHash = bindgroupLayoutHash;
        this.bindgroupHash = bindgroupHash;
        this.factorsHash = factorsHash;
    }

}