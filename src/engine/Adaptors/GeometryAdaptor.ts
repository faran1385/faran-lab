import {GeometryInternal} from "../internals/GeometryInternal.ts";
import {AttributeInternal} from "../internals/AttributeInternal.ts";
import {type GeometryAttributePlan, planGeometryAttributes} from "../producers/utils.ts";
import {
    type MorphPlan,
    morphPlanKey,
} from "../producers/MorphProducer.ts";
import {stableKey} from "../hashing/utils/stableKey.ts";
import {planGeometryBindings} from "../producers/utils.ts";
import type {GeometryBindingPlan} from "../producers/BindGroupLayoutProducer.ts";
import {schedulePreFrame} from "./PreFrameQueue.ts";
import {Source} from "./Source.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {MorphTargetWrapper} from "../wrappers/MorphTargetWrapper.ts";

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

    private attributePlanDirty = true;
    private attributeBindingsDirty = true;
    private drawInfoDirty = true;
    private morphTargetDirty = true;
    private morphCompatibilityDirty = true;

    private attributePlan: GeometryAttributePlan = {slots: [], byName: new Map()};
    private morphPlan: MorphPlan | null = null;
    private geometryBindingPlan: GeometryBindingPlan = {signature: "geometry:none"};
    private boundMorphTargets?: MorphTargetWrapper;
    private boundBindings = new Set<number>();
    private layoutKey = "";
    private layoutVersion = 0;
    private drawKey = "";
    private readonly attributes = new Map<string, AttributeInternal>();

    constructor(owner: GeometryWrapper) {
        this.owner = owner;
        this.internal = new GeometryInternal();
        schedulePreFrame(this.task);
    }

    /**
     * Attribute structure changed. Rebuild the plan and vertex bindings; only a position change can invalidate
     * morph compatibility, but every attribute change can affect vertex counts used by draw info.
     */
    invalidateAttributes(name?: string): void {
        this.markDirty();
        this.attributePlanDirty = true;
        this.attributeBindingsDirty = true;
        this.drawInfoDirty = true;
        if (name === "position") {
            this.morphCompatibilityDirty = true;
        }
        schedulePreFrame(this.task);
    }

    /** Index-buffer changes affect the draw command, not the vertex attribute plan. */
    invalidateIndices(): void {
        this.markDirty();
        this.drawInfoDirty = true;
        schedulePreFrame(this.task);
    }

    /** A different morph target wrapper changes morph bindings, compatibility and shader shape. */
    invalidateMorphTargets(): void {
        this.markDirty();
        this.morphTargetDirty = true;
        this.morphCompatibilityDirty = true;
        schedulePreFrame(this.task);
    }

    private markDirty(): void {
        const wasClean = !this.attributePlanDirty && !this.attributeBindingsDirty && !this.drawInfoDirty
            && !this.morphTargetDirty && !this.morphCompatibilityDirty;
        if (wasClean) this.changed.notify();
    }

    getAttributePlan(): GeometryAttributePlan {
        return this.attributePlan;
    }

    /** What the vertex shader needs to know about the morph targets, or null when the geometry has none. */
    getMorphPlan(): MorphPlan | null {
        return this.morphPlan;
    }

    /** Dynamic resource bindings for this geometry; read after ensure(). */
    getBindingPlan(): GeometryBindingPlan {
        return this.geometryBindingPlan;
    }

    /**
     * Bumped when names, slots, formats or strides changed, or when the morph targets' shape changed (targets added,
     * removed, normals/tangents appeared), i.e. whenever generated vertex shader code is stale.
     */
    getLayoutVersion(): number {
        return this.layoutVersion;
    }

    ensure(): void {
        if (!this.attributePlanDirty && !this.attributeBindingsDirty && !this.drawInfoDirty
            && !this.morphTargetDirty && !this.morphCompatibilityDirty) return;

        const rebuildPlan = this.attributePlanDirty;
        const syncAttributes = this.attributeBindingsDirty;
        const syncDrawInfo = this.drawInfoDirty;
        const syncMorphTarget = this.morphTargetDirty;
        const validateMorph = this.morphCompatibilityDirty;

        this.attributePlanDirty = false;
        this.attributeBindingsDirty = false;
        this.drawInfoDirty = false;
        this.morphTargetDirty = false;
        this.morphCompatibilityDirty = false;

        if (rebuildPlan) {
            this.attributePlan = planGeometryAttributes(this.owner);
        }

        if (syncAttributes) {
            this.syncAttributeBindings();
        }

        if (syncDrawInfo) {
            this.syncDrawInfo();
        }

        if (syncMorphTarget) {
            this.geometryBindingPlan = planGeometryBindings(!!this.owner.getMorphTargets());
            this.syncMorphTarget();
        } else if (validateMorph) {
            this.validateMorphCompatibility();
        }

        if (rebuildPlan || syncMorphTarget) {
            this.updateLayoutVersion();
        }
    }

    private syncAttributeBindings(): void {
        const plan = this.attributePlan;
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
    }

    /**
     * Synchronizes geometry-owned resources using centrally planned binding numbers. The target wrapper owns
     * the buffers; this adaptor only installs/removes their references.
     */
    private syncMorphTarget(): void {
        const targets = this.owner.getMorphTargets();
        const bindgroup = this.internal.bindgroupInteractor;

        if (targets) {
            this.validateMorphCompatibility();
            const internal = targets.adaptor.internal;
            const slots = this.geometryBindingPlan.morph!;
            bindgroup.setStorage(slots.deltas, internal.deltas, GPUShaderStage.VERTEX);
            bindgroup.setUniform(slots.header, internal.header, GPUShaderStage.VERTEX);
            this.boundBindings = new Set([slots.deltas, slots.header]);
            this.morphPlan = {hasNormal: targets.hasNormal(), hasTangent: targets.hasTangent()};
            this.boundMorphTargets = targets;
            return;
        }

        for (const binding of this.boundBindings) bindgroup.removeBinding(binding);
        this.boundBindings.clear();
        this.boundMorphTargets = undefined;
        this.morphPlan = null;
    }

    private validateMorphCompatibility(): void {
        const targets = this.owner.getMorphTargets();
        if (!targets) return;

        const position = this.attributePlan.byName.get("position");
        if (!position || position.format !== "float32x3") {
            throw new Error("GeometryAdaptor: morph targets need a float32x3 \"position\" attribute to morph");
        }
        const vertexCount = this.owner.getAttribute("position")!.getData().byteLength / position.arrayStride;
        if (vertexCount !== targets.getVertexCount()) {
            throw new Error(`GeometryAdaptor: the morph targets have ${targets.getVertexCount()} vertices but the position attribute has ${vertexCount}`);
        }
    }

    private updateLayoutVersion(): void {
        const layoutKey = this.attributePlan.slots.map((s) => `${s.name}:${s.slot}:${s.format}:${s.arrayStride}`).join("|")
            + `#${morphPlanKey(this.morphPlan)}#${this.geometryBindingPlan.signature}`;
        if (layoutKey !== this.layoutKey) {
            this.layoutKey = layoutKey;
            this.layoutVersion++;
        }
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
