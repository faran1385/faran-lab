import type {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {GeometryHashes, HashData} from "../hashing/utils/HashData.ts";
import type {DrawInfo, RenderItem, VertexBufferBinding} from "./RenderItem.ts";
import type {RenderContext} from "./RenderContext.ts";

/** The item layer: pure lookup. Reads resolved hashes and the managers' resources, creates and computes nothing. */
export class RenderItemAssembler {
    static assemble(node: NodeWrapper, p: PrimitiveWrapper, data: HashData, ctx: RenderContext): RenderItem {
        const {managers, rendererUUID} = ctx;

        return {
            pipeline: managers.pipelineManager.getRaw(data.pipeline.pipeline),
            bindGroups: [
                {slot: 0, bindGroup: managers.bindgroupManager.getRaw(rendererUUID)},
                {slot: 1, bindGroup: managers.bindgroupManager.getRaw(data.material.bindgroup)},
                {slot: 2, bindGroup: managers.bindgroupManager.getRaw(node.uuid)},
            ],
            vertexBuffers: RenderItemAssembler.vertexBuffers(p, data.geometry, ctx),
            draw: RenderItemAssembler.drawInfo(p, data.geometry, ctx),
            hashData: data
        };
    }

    private static vertexBuffers(p: PrimitiveWrapper, geometry: GeometryHashes, ctx: RenderContext): VertexBufferBinding[] {
        const {producer, managers} = ctx;
        const attrPlan = producer.getAttributePlan(p.getGeometry());

        return attrPlan.slots.map((slot) => ({
            slot: slot.slot,
            buffer: managers.bufferManager.getRaw(geometry.attributeBuffers.get(slot.name)!),
        }));
    }

    private static drawInfo(p: PrimitiveWrapper, geometryHashes: GeometryHashes, ctx: RenderContext): DrawInfo {
        const {producer, managers} = ctx;
        const geometry = p.getGeometry();
        const indices = geometry.getIndices();
        const attrPlan = producer.getAttributePlan(geometry);
        const positionSlot = attrPlan.slots.find(s => s.name === "position")!;

        if (indices) {
            const bytesPerIndex = indices.format === "uint32" ? 4 : 2;
            return {
                indexed: true,
                count: indices.getData().byteLength / bytesPerIndex,
                indexBuffer: managers.bufferManager.getRaw(geometryHashes.indices!),
                indexFormat: indices.format as GPUIndexFormat,
            };
        }

        const position = geometry.getAttribute("position")!;
        return {
            indexed: false,
            count: position.getData().byteLength / positionSlot.arrayStride,
        };
    }
}
