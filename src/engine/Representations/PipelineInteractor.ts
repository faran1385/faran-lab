import {PipelineRepresentation} from "./PipelineRepresentation.ts";
import type {ShaderStageRepresentation} from "./ShaderStageRepresentation.ts";
import type {BindgroupInteractor} from "./BindgroupInteractor.ts";
import {stableKey} from "../hashing/utils/stableKey.ts";

/** What the frame being rendered into dictates. Pipelines never invent these. */
export interface PipelineFrame {
    colorFormat: GPUTextureFormat;
    depthFormat: GPUTextureFormat;
}

/** What the material dictates (derived from alphaMode). */
export interface PipelineMaterialState {
    blend?: GPUBlendState;
    depthWriteEnabled: boolean;
}

/**
 * The public way to describe a pipeline. The blend state and the depth state each combine a material input with a
 * frame input, so the interactor keeps both halves and composes the final state once it has them.
 */
export class PipelineInteractor extends PipelineRepresentation {
    private materialState: PipelineMaterialState = {blend: undefined, depthWriteEnabled: true};
    private frame: PipelineFrame | null = null;
    private composedKey = "";

    constructor() {
        super();
    }

    setFragment(stage: ShaderStageRepresentation) {
        this.setFragmentShader({
            entryPoint: stage.getEntryPoint(),
            code: stage.getCode()
        })
    }

    setVertex(stage: ShaderStageRepresentation) {
        this.setVertexShader({
            entryPoint: stage.getEntryPoint(),
            code: stage.getCode()
        })
    }

    setVertexBuffers(buffers: GPUVertexBufferLayout[]) {
        this.setBuffers(buffers);
    }

    setPrimitiveState(state: GPUPrimitiveState) {
        this.setPrimitive(state);
    }

    setMaterialState(state: PipelineMaterialState) {
        this.materialState = state;
        this.compose();
    }

    setFrame(frame: PipelineFrame) {
        this.frame = frame;
        this.compose();
    }

    setBindgroup(group: number, bindgroup: BindgroupInteractor) {
        this.bindgroups.set(group, bindgroup);
        this.layout.setLayout(group, bindgroup.layout);
    }

    removeBindgroup(group: number) {
        this.bindgroups.delete(group);
        this.layout.removeLayout(group);
    }

    /** Writes the color target and depth state, but only when the composed result actually differs. */
    private compose() {
        if (!this.frame) return;
        const key = stableKey([this.frame, this.materialState]);
        if (key === this.composedKey) return;
        this.composedKey = key;

        this.setFrameTarget({format: this.frame.colorFormat, location: 0, blend: this.materialState.blend});
        this.setDepthStencil({
            format: this.frame.depthFormat,
            depthWriteEnabled: this.materialState.depthWriteEnabled,
            depthCompare: "less",
        });
    }
}
