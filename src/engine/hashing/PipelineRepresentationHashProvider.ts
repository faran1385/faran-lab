import {RepresentationHashProvider} from "./RepresentationHashProvider.ts";
import {stableKey} from "./utils/stableKey.ts";
import type {FrameTarget, VertexBufferEntry} from "../Representations/PipelineRepresentation.ts";
import type {PipelineLayoutRepresentation} from "../Representations/PipelineLayoutRepresentation.ts";
import type {ShaderStageRepresentation} from "../Representations/ShaderStageRepresentation.ts";

type InputFunctions = {
    getVertexBuffers: () => VertexBufferEntry[],
    getFragmentTargets: () => Map<number, FrameTarget>,
    getLayout: () => PipelineLayoutRepresentation | undefined,
    getVertexShader: () => ShaderStageRepresentation | undefined,
    getFragmentShader: () => ShaderStageRepresentation | undefined,
    getPrimitive: () => GPUPrimitiveState | undefined,
    getDepthStencil: () => GPUDepthStencilState | undefined,
}

/**
 * Composed from the other representations' hashes (layout, both shader stages) plus the pipeline's own state:
 * vertex layout, render targets, primitive state, depth/stencil. Vertex buffer *data* is not part of it.
 */
export class PipelineRepresentationHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: (hasher) => {
                const layout = T.getLayout();
                const vertex = T.getVertexShader();
                const fragment = T.getFragmentShader();
                layout?.hashProvider.update(hasher);
                vertex?.hashProvider.update(hasher);
                fragment?.hashProvider.update(hasher);

                const buffers = T.getVertexBuffers().map((a) => `${a.name}:${a.format}:${a.stride}`).join(",");
                const targets = Array.from(T.getFragmentTargets().entries())
                    .sort(([a], [b]) => a - b)
                    .map(([location, target]) => `${location}:${target.format}`)
                    .join(",");

                return [
                    `l=${layout?.hashProvider.current ?? "none"}`,
                    `v=${vertex?.hashProvider.current ?? "none"}@${vertex?.getEntryPoint() ?? ""}`,
                    `f=${fragment?.hashProvider.current ?? "none"}@${fragment?.getEntryPoint() ?? ""}`,
                    `vb=${buffers}`,
                    `t=${targets}`,
                    `p=${stableKey(T.getPrimitive())}`,
                    `d=${stableKey(T.getDepthStencil())}`,
                ].join("#");
            },
            getChildrenChangedAt: () => Math.max(
                T.getLayout()?.hashProvider.getChangedAt() ?? 0,
                T.getVertexShader()?.hashProvider.getChangedAt() ?? 0,
                T.getFragmentShader()?.hashProvider.getChangedAt() ?? 0,
            ),
        });
    }
}
