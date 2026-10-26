import {GeometryInternal} from "../internals/GeometryInternal.ts";
import {AttributeInternal} from "../internals/AttributeInternal.ts";
import {type GeometryAttributePlan, planGeometryAttributes} from "../producers/utils.ts";
import {stableKey} from "../hashing/utils/stableKey.ts";
import {schedulePreFrame} from "./PreFrameQueue.ts";
import {Source} from "./Source.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";

/**
 * Translates a GeometryWrapper (attributes keyed by name) into a GeometryInternal (vertex buffers keyed by slot, plus
 * the draw command). Slots and shader locations come from sorting the attribute names, same as the attribute plan the
 * shader producers use, so the shader, the pipeline and the draw call agree.
 */
export class GeometryAdaptor {
    readonly internal: GeometryInternal;
    readonly changed = new Source<void>();

    private readonly owner: GeometryWrapper;
    private readonly task = () => this.ensure();
    private attributesDirty = true;

    private attributePlan: GeometryAttributePlan = {slots: [], byName: new Map()};
    private layoutKey = "";
    private layoutVersion = 0;
    private drawKey = "";
    private readonly attributes = new Map<string, AttributeInternal>();

    constructor(owner: GeometryWrapper) {
        this.owner = owner;
        this.internal = new GeometryInternal();
        schedulePreFrame(this.task);
    }

    /** Called by the wrapper when attributes or indices were added, removed or replaced. */
    invalidate() {
        if (!this.attributesDirty) {
            this.attributesDirty = true;
            this.changed.notify();
        }
        schedulePreFrame(this.task);
    }

    getAttributePlan(): GeometryAttributePlan {
        return this.attributePlan;
    }

    /** Bumped when names, slots, formats or strides changed, i.e. whenever generated shader code is stale. */
    getLayoutVersion(): number {
        return this.layoutVersion;
    }

    ensure(): void {
        if (!this.attributesDirty) return;
        this.attributesDirty = false;

        const plan = planGeometryAttributes(this.owner);
        this.attributePlan = plan;

        const layoutKey = plan.slots.map((s) => `${s.name}:${s.slot}:${s.format}:${s.arrayStride}`).join("|");
        if (layoutKey !== this.layoutKey) {
            this.layoutKey = layoutKey;
            this.layoutVersion++;
        }

        const live = new Set<string>();
        for (const slot of plan.slots) {
            live.add(slot.name);
            const source = this.owner.getAttribute(slot.name)!;
            const internal = source.adaptor.internal;
            const layout: GPUVertexBufferLayout = {
                arrayStride: slot.arrayStride,
                stepMode: "vertex",
                attributes: [{shaderLocation: slot.shaderLocation, offset: 0, format: slot.format}],
            };

            // A newly attached AttributeInternal has no layout yet. Always synchronize it, not only
            // attributes already present in the tracking map.
            this.attributes.set(slot.name, internal);
            if (stableKey(internal.getLayout()) !== stableKey(layout)) {
                internal.setLayout(layout);
            }

            if (this.internal.getVertexAttributes().get(slot.slot) !== internal) {
                this.internal.setVertexAttribute(slot.slot, internal);
            }
        }

        for (const name of Array.from(this.attributes.keys())) {
            if (!live.has(name)) this.attributes.delete(name);
        }
        for (const slot of Array.from(this.internal.getVertexAttributes().keys())) {
            if (slot >= plan.slots.length) this.internal.removeVertexAttribute(slot);
        }

        this.syncDrawInfo();
    }

    private syncDrawInfo(): void {
        // Every attribute must contain whole vertices, including for indexed draws.
        let commonVertexCount: number | undefined;
        for (const slot of this.attributePlan.slots) {
            if (slot.arrayStride <= 0) {
                throw new Error(`GeometryAdaptor: attribute "${slot.name}" has invalid stride ${slot.arrayStride}`);
            }
            const attribute = this.owner.getAttribute(slot.name)!;
            const byteLength = attribute.getData().byteLength;
            if (byteLength % slot.arrayStride !== 0) {
                throw new Error(`GeometryAdaptor: attribute "${slot.name}" byte length (${byteLength}) is not divisible by stride ${slot.arrayStride}`);
            }
            const count = byteLength / slot.arrayStride;
            if (commonVertexCount !== undefined && count !== commonVertexCount) {
                throw new Error(`GeometryAdaptor: attribute "${slot.name}" has ${count} vertices; expected ${commonVertexCount} to match the other attributes`);
            }
            commonVertexCount = count;
        }

        const indices = this.owner.getIndices();
        if (indices) {
            const bytesPerIndex = indices.format === "uint16" ? 2 : 4;
            const indexBytes = indices.getData().byteLength;
            if (indexBytes % bytesPerIndex !== 0) {
                throw new Error(`GeometryAdaptor: index buffer byte length (${indexBytes}) is not divisible by ${bytesPerIndex} for ${indices.format} indices`);
            }
            const indexCount = indexBytes / bytesPerIndex;
            const key = `indexed:${indices.uuid}:${indices.format}:${indexCount}`;
            if (key === this.drawKey) return;
            this.drawKey = key;
            this.internal.setDrawInfo({indexCount, indexBuffer: indices, indexFormat: indices.format});
            return;
        }

        // Non-indexed: count the vertices of "position" if there is one, otherwise of the first attribute.
        const slots = this.attributePlan.slots;
        const counted = this.attributePlan.byName.get("position") ?? slots[0];
        const source = counted ? this.owner.getAttribute(counted.name) : undefined;
        const vertexCount = counted && source
            ? source.getData().byteLength / counted.arrayStride
            : 0;
        const key = `draw:${vertexCount}`;
        if (key === this.drawKey) return;
        this.drawKey = key;
        this.internal.setDrawInfo({vertexCount});
    }
}
