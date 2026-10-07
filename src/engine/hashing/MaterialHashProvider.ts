import {HashHandler} from "./utils/HashHandler.ts";
import {AggregateHashHandler} from "./utils/AggregateHashHandler.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";
import {MaterialComponentWrapper} from "../wrappers/MaterialComponentWrapper.ts";
import type {Material} from "../importers/utils/IR.ts";
import {getEpoch} from "./utils/epoch.ts";
import type {Hasher} from "./utils/Hasher.ts";
import {VersionFlag} from "./utils/VersionFlag.ts";

type InputFunctions = {
    getSortedComponents: () => MaterialComponentWrapper[],
    getAlphaMode: () => Material["alphaMode"],
    getDoubleSided: () => boolean,
}

export class MaterialHashProvider {
    private pipelineSettingsHash: HashHandler;
    private shaderHash: AggregateHashHandler;
    private bindgroupHash: AggregateHashHandler;
    private factorsHash: AggregateHashHandler;
    private factorNeedUpdateFlag = new VersionFlag()
    private readonly changeStamp = new ChangeStamp();
    private memoEpoch = -1;
    private memoChangedAt = 0;
    private wrapperFunctions: {
        getSortedComponents: InputFunctions["getSortedComponents"],
    }


    constructor(uuid: string, T: InputFunctions) {
        this.wrapperFunctions = {
            getSortedComponents: T.getSortedComponents
        }
        this.pipelineSettingsHash = new HashHandler(() => `${T.getAlphaMode()}|${T.getDoubleSided()}`)
        this.factorsHash = new AggregateHashHandler(() => uuid + T.getSortedComponents().map(c => `${c.name}${c.getFactors().length}`).join("|"))
        this.shaderHash = new AggregateHashHandler((hasher) =>
            `${T.getAlphaMode()}|` + T.getSortedComponents()
                .map((c) => `${c.name}:${c.hashProvider.convertToShaderKeyHash(hasher)}`)
                .join("|")
        )
        this.bindgroupHash = new AggregateHashHandler((hasher) =>
            `${this.factorsHash.convertToHash(hasher)}` + T.getSortedComponents()
                .map((c) => `${c.name}:${c.hashProvider.convertToResourceHash(hasher)}`)
                .join("|")
        )
    }


    /** Latest change stamp of this material or of anything it is built from (components, textures, images, samplers). */
    getChangedAt(): number {
        const epoch = getEpoch();
        if (this.memoEpoch === epoch) return this.memoChangedAt;

        let at = this.changeStamp.get();
        for (const component of this.wrapperFunctions.getSortedComponents()) {
            const componentAt = component.hashProvider.getChangedAt();
            if (componentAt > at) at = componentAt;
        }

        this.memoEpoch = epoch;
        this.memoChangedAt = at;
        return at;
    }

    convertToPipelineSettingsHash(hasher: Hasher): string {
        return this.pipelineSettingsHash.convertToHash(hasher);
    }

    convertToShaderHash(hasher: Hasher): string {
        return this.shaderHash.convertToHash(hasher);
    }

    convertToBindgroupLayoutHash(hasher: Hasher, bindingSignature: string): string {
        const shapes = this.wrapperFunctions.getSortedComponents().map((c) => `${c.name}:${c.hashProvider.convertToShapeHash(hasher)}`)
            .join("|");
        return hasher.hashString(`${shapes}#${bindingSignature}`);
    }

    convertToBindgroupHash(hasher: Hasher): string {
        return this.bindgroupHash.convertToHash(hasher);
    }

    convertToFactorsHash(hasher: Hasher): string {
        return this.factorsHash.convertToHash(hasher);
    }

    markChangeStamp() {
        this.changeStamp.mark();
    }

    markPipelineSettingsHash() {
        this.pipelineSettingsHash.addVersion()
    }

    syncFactorUpdate() {
        this.factorNeedUpdateFlag.sync();
    }

    markFactorUpdate() {
        this.factorNeedUpdateFlag.addVersion()
    }

    factorNeedsUpdate() {
        return this.factorNeedUpdateFlag.needsUpdate()
    }

}