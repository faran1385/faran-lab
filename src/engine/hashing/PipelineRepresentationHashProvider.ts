import { RepresentationHashProvider } from "./RepresentationHashProvider.ts";
import { stableKey } from "./utils/stableKey.ts";
import type { FrameTarget } from "../Representations/PipelineRepresentation.ts";
import type { PipelineLayoutRepresentation } from "../Representations/PipelineLayoutRepresentation.ts";

type ShaderSource = { code: string; entryPoint: string };

type InputFunctions = {
    getVertexBuffers: () => GPUVertexBufferLayout[];
    getFragmentTargets: () => Map<number, FrameTarget>;
    getLayout: () => PipelineLayoutRepresentation | undefined;
    getVertexShader: () => ShaderSource | undefined;
    getFragmentShader: () => ShaderSource | undefined;
    getPrimitive: () => GPUPrimitiveState | undefined;
    getDepthStencil: () => GPUDepthStencilState | undefined;
};

/**
 * Hashes pipeline-creation state: layout, shader source and entry points, vertex layouts,
 * render-target formats, primitive state and depth/stencil state. Buffer contents are excluded.
 */
export class PipelineRepresentationHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: (hasher) => {
                const layout = T.getLayout();
                const vertex = T.getVertexShader();
                const fragment = T.getFragmentShader();
                const buffers = stableKey(T.getVertexBuffers());
                const targets = Array.from(T.getFragmentTargets().entries())
                    .sort(([a], [b]) => a - b)
                    .map(([location, target]) => `${location}:${target.format}:${stableKey(target.blend)}`)
                    .join(",");

                return [
                    `layout=${layout?.hashProvider.convertToHash(hasher) ?? "none"}`,
                    `vertex=${vertex ? hasher.hashString(vertex.code) : "none"}@${vertex?.entryPoint ?? ""}`,
                    `fragment=${fragment ? hasher.hashString(fragment.code) : "none"}@${fragment?.entryPoint ?? ""}`,
                    `vertexBuffers=${buffers}`,
                    `targets=${targets}`,
                    `primitive=${stableKey(T.getPrimitive())}`,
                    `depthStencil=${stableKey(T.getDepthStencil())}`,
                ].join("#");
            },
            getChildrenChangedAt: () => T.getLayout()?.hashProvider.getChangedAt() ?? 0,
        });
    }
}
