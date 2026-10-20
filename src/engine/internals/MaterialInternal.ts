import { v4 as uuidv4 } from "uuid";
import { MaterialInternalHashProvider } from "../hashing/MaterialInternalHashProvider.ts";
import { BindgroupInteractor } from "../Representations/BindgroupInteractor.ts";

/**
 * The pipeline state a material contributes. Plain data: the render side builds pipelines from it without knowing
 * what a material is.
 */
export interface MaterialPipelineSettings {
    /** One pipeline per entry, in draw order (a double-sided blended material draws its back faces first). */
    cullModes: GPUCullMode[];
    blend?: GPUBlendState;
    depthWriteEnabled: boolean;
}

export const DEFAULT_MATERIAL_PIPELINE_SETTINGS: MaterialPipelineSettings = {
    cullModes: ["back"],
    blend: undefined,
    depthWriteEnabled: true,
};

export class MaterialInternal {
    private bindgroupInteractor = new BindgroupInteractor();
    private pipelineSettings: MaterialPipelineSettings = DEFAULT_MATERIAL_PIPELINE_SETTINGS;
    private group: number;
    readonly uuid: string;
    readonly hashProvider: MaterialInternalHashProvider;

    constructor(group: number = 1) {
        this.group = group;
        this.uuid = uuidv4();
        this.hashProvider = new MaterialInternalHashProvider({
            getGroup: () => this.group,
            getBindgroup: () => this.bindgroupInteractor,
            getPipelineSettings: () => this.pipelineSettings,
        });
    }

    getGroup() {
        return this.group;
    }

    getBindgroupInteractor() {
        return this.bindgroupInteractor;
    }

    getPipelineSettings() {
        return this.pipelineSettings;
    }

    setPipelineSettings(settings: MaterialPipelineSettings) {
        this.pipelineSettings = settings;
        this.hashProvider.markChanged();
    }
}
