import type {GeometryInternal} from "../internals/GeometryInternal.ts";
import type {BindGroupBinding, DrawCall, RenderItem, VertexBufferBinding} from "./RenderItem.ts";
import type {RenderContext} from "./RenderContext.ts";

/** The item layer: pure lookup. Reads keys and the managers' resources, creates and computes nothing. */
export class RenderItemAssembler {
    static assemble(
        pipelineKeys: readonly string[],
        bindgroupKeys: readonly { slot: number, key: string }[],
        geometry: GeometryInternal,
        ctx: RenderContext,
    ): RenderItem | null {
        const draw = RenderItemAssembler.drawCall(geometry, ctx);

        const {managers} = ctx;
        const bindGroups: BindGroupBinding[] = bindgroupKeys.map(({slot, key}) => ({
            slot,
            bindGroup: managers.bindgroupManager.getRaw(key),
        }));

        const vertexBuffers: VertexBufferBinding[] = Array.from(geometry.getVertexAttributes().entries())
            .sort(([a], [b]) => a - b)
            .map(([slot, attribute]) => ({
                slot,
                buffer: managers.bufferManager.getRaw(attribute.hashProvider.convertToHash())
            }));

        return {
            // draw order is the order the node adapter built the pipelines in: never Map iteration order
            pipelines: pipelineKeys.map((key) => managers.pipelineManager.getRaw(key)),
            bindGroups,
            vertexBuffers,
            draw,
        };
    }

    private static drawCall(geometry: GeometryInternal, ctx: RenderContext): DrawCall {
        const draw = geometry.getDrawInfo();
        if (!draw) throw new Error("RenderItem doesn't include a draw call");

        if ("indexBuffer" in draw) {
            return {
                indexed: true,
                indexBuffer: ctx.managers.bufferManager.getRaw(draw.indexBuffer.hashProvider.convertToHash()),
                indexFormat: draw.indexFormat,
                indexCount: draw.indexCount,
                instanceCount: draw.instanceCount ?? 1,
                firstIndex: draw.firstIndex ?? 0,
                baseVertex: draw.baseVertex ?? 0,
                firstInstance: draw.firstInstance ?? 0,
            };
        }

        return {
            indexed: false,
            vertexCount: draw.vertexCount,
            instanceCount: draw.instanceCount ?? 1,
            firstVertex: draw.firstVertex ?? 0,
            firstInstance: draw.firstInstance ?? 0,
        };
    }
}
