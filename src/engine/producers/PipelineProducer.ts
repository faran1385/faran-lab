import type {PipelineRepresentation} from "../Representations/PipelineRepresentation.ts";
import type {CentralManager} from "../managers/CentralManager.ts";

export interface PipelineProduceArgs {
    pipeline: PipelineRepresentation;
    label: string;
    /** Keys in the managers; all of them must already exist. */
    layoutKey: string;
    vertexModuleKey: string;
    fragmentModuleKey: string;
    managers: CentralManager;
}

export class PipelineProducer {
    /** A plain translation: everything (blend, depth write, cull mode, formats) was decided on the representation. */
    static produce({pipeline, label, layoutKey, vertexModuleKey, fragmentModuleKey, managers}: PipelineProduceArgs): GPURenderPipelineDescriptor {
        const vertex = pipeline.getVertexShader();
        const fragment = pipeline.getFragmentShader();
        const frameTargets = pipeline.getFragmentTargets();

        // color targets are indexed by @location; a gap becomes null
        const maxLocation = frameTargets.size === 0 ? -1 : Math.max(...frameTargets.keys());
        const targets: (GPUColorTargetState | null)[] = [];
        for (let location = 0; location <= maxLocation; location++) {
            const target = frameTargets.get(location);
            targets.push(target ? {format: target.format, blend: target.blend} : null);
        }

        return {
            label,
            layout: managers.pipelineLayoutManager.getRaw(layoutKey),
            vertex: {
                module: managers.shaderModuleManager.getRaw(vertexModuleKey),
                entryPoint: vertex.entryPoint,
                buffers: pipeline.getVertexBuffers(),
            },
            fragment: {
                module: managers.shaderModuleManager.getRaw(fragmentModuleKey),
                entryPoint: fragment.entryPoint,
                targets,
            },
            primitive: pipeline.getPrimitive(),
            depthStencil: pipeline.getDepthStencil(),
        };
    }
}
