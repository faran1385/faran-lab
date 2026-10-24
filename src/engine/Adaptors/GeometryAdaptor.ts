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
 *
 * One AttributeInternal is kept per attribute name for the lifetime of the adapter: a buffer's identity is its uuid,
 * so recreating them on every sync would re-create every GPU buffer.
 */
export class GeometryAdaptor {
    readonly internal: GeometryInternal;

    /** Fires when the vertex layout or the draw command is stale. Dependents schedule their own rebuild. */
    readonly changed = new Source<void>();

    private readonly owner: GeometryWrapper;
    private readonly task = () => this.ensure();
    private dirty = true;

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
        if (!this.dirty) {
            this.dirty = true;
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
        if (!this.dirty) return;
        this.dirty = false;

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


            if (!this.attributes.has(slot.name)) {
                this.attributes.set(slot.name, internal);
            } else {
                if (stableKey(internal.getLayout()) !== stableKey(layout)) internal.setLayout(layout);
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
        const indices = this.owner.getIndices();

        if (indices) {
            const bytesPerIndex = indices.format === "uint16" ? 2 : 4;
            const indexCount = indices.getData().byteLength / bytesPerIndex;
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
        const vertexCount = counted && source && counted.arrayStride > 0
            ? source.adaptor.internal.getData().byteLength / counted.arrayStride
            : 0;
        const key = `draw:${vertexCount}`;
        if (key === this.drawKey) return;
        this.drawKey = key;
        this.internal.setDrawInfo({vertexCount});
    }
}
