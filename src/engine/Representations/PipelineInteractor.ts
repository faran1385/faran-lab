import {PipelineRepresentation} from "./PipelineRepresentation.ts";
import type {ShaderStageRepresentation} from "./ShaderStageRepresentation.ts";
import type {BindgroupInteractor} from "./BindgroupInteractor.ts";


export class PipelineInteractor extends PipelineRepresentation {

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

    setBindgroup(group: number, bindgroup: BindgroupInteractor) {
        this.bindgroups.set(group, bindgroup);
        this.layout.setLayout(group, bindgroup.layout);
    }

    removeBindgroup(group: number) {
        this.bindgroups.delete(group);
        this.layout.removeLayout(group);
    }
}