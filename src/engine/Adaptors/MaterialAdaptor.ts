import {MaterialInternal} from "../internals/MaterialInternal.ts";
import {BufferInternal} from "../internals/BufferInternal.ts";
import {
    type MaterialFactorsPlan,
    planMaterialBindings,
    planMaterialFactors,
} from "../producers/utils.ts";
import {FACTORS_BINDING, type MaterialBindingPlan} from "../producers/BindGroupLayoutProducer.ts";
import {stableKey} from "../hashing/utils/stableKey.ts";
import {schedulePreFrame} from "./PreFrameQueue.ts";
import {Source} from "./Source.ts";
import type {ComponentChange} from "./MaterialComponentAdaptor.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {MaterialComponentWrapper} from "../wrappers/MaterialComponentWrapper.ts";

export interface MaterialPipelineSettings {
    /** One pipeline per entry, in draw order. */
    cullModes: GPUCullMode[];
    blend?: GPUBlendState;
    depthWriteEnabled: boolean;
}

const BLEND: GPUBlendState = {
    color: {srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add"},
    alpha: {srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add"},
};

/**
 * Same rule the old PipelineWrapper used. Kept here so the adapter does not depend on a wrapper that is going away.
 * cullMode "front" culls front faces, so that entry DRAWS back faces: a double-sided blended material needs it first.
 */
function cullModesOf(alphaMode: "opaque" | "mask" | "blend", doubleSided: boolean): GPUCullMode[] {
    if (!doubleSided) return ["back"];
    if (alphaMode === "blend") return ["front", "back"];
    return ["none"];
}

function packFactors(plan: MaterialFactorsPlan): Float32Array {
    return new Float32Array(Array.from(plan.values()).flatMap((entry) => entry.factor));
}

/** Names, types and offsets only. Two plans with the same shape generate the same shader and the same buffer layout. */
function factorsShape(plan: MaterialFactorsPlan): string {
    return Array.from(plan.entries()).map(([name, e]) => `${name}:${e.wgslType}@${e.offset}`).join("|");
}

/**
 * Translates a MaterialWrapper into its MaterialInternal: the binding plan, factors buffer, and bind-group
 * entries/layout. Pipeline state is kept on this adapter and pushed to dependent node adapters through the pre-frame
 * queue; it is deliberately not part of MaterialInternal.
 *
 * Nothing is computed when a setter runs. Setters call `invalidate*()`, which sets a flag and schedules `task` on the
 * pre-frame queue; `ensure()` then rebuilds once from the final state, so a half-built material (a texture set before
 * its sampler, ten components added in a row) is never planned.
 *
 * Until the queue has been flushed the internal is empty. Anything that needs the finished internal calls `ensure()`.
 */
export class MaterialAdaptor {
    readonly internal: MaterialInternal;

    /** Binding-plan changes invalidate generated shader code. Factor values alone never fire this. */
    readonly changed = new Source<void>();
    /** Pipeline-state changes are applied by node adapters to existing pipeline representations in the frame queue. */
    readonly pipelineChanged = new Source<void>();

    private readonly owner: MaterialWrapper;
    /** One stable function reference, so the pre-frame queue dedupes. */
    private readonly task = () => this.ensure();
    private readonly onComponentChange = (change: ComponentChange) => {
        if (change === "structure") this.invalidatePlan();
        else this.invalidateFactors();
    };

    private planDirty = true;
    private settingsDirty = true;
    private factorsDirty = true;

    private bindingPlan: MaterialBindingPlan = {slots: [], byComponent: new Map(), signature: ""};
    private factorsPlan: MaterialFactorsPlan = new Map();
    private factorsShapeKey = "";
    private planVersion = 0;

    private factorsBuffer: BufferInternal | null = null;
    private boundBindings = new Set<number>();
    private settingsKey = "";
    private pipelineSettings: MaterialPipelineSettings = {
        cullModes: ["back"],
        blend: undefined,
        depthWriteEnabled: true,
    };

    constructor(owner: MaterialWrapper) {
        this.owner = owner;
        this.internal = new MaterialInternal();
        schedulePreFrame(this.task);
    }

    // -- components -------------------------------------------------------

    setMaterialComponent(component: MaterialComponentWrapper) {
        component.adaptor.connectAdaptor(this.internal.uuid, this.onComponentChange);
        this.invalidatePlan();
    }

    removeMaterialComponent(component: MaterialComponentWrapper) {
        component.adaptor.disconnectAdaptor(this.internal.uuid);
        this.invalidatePlan();
    }

    // -- invalidation (cheap, idempotent, no computation) -----------------

    /** A component was added/removed or a texture changed: bindings, factors layout and shader inputs are stale. */
    invalidatePlan() {
        this.factorsDirty = true;
        if (!this.planDirty) {
            this.planDirty = true;
            this.changed.notify();
        }
        schedulePreFrame(this.task);
    }

    /** Only factor values (or alphaCutoff) changed: the plan is kept, the buffer is repacked. */
    invalidateFactors() {
        this.factorsDirty = true;
        schedulePreFrame(this.task);
    }

    /** alphaMode or doubleSided changed: schedule a pipeline-only update, never a shader/bind-group rebuild. */
    invalidateSettings() {
        this.settingsDirty = true;
        schedulePreFrame(this.task);
    }

    /** Pipeline state is adapter output; it is deliberately absent from MaterialInternal. */
    getPipelineSettings(): MaterialPipelineSettings {
        return this.pipelineSettings;
    }

    // -- what dependents read after ensure() ------------------------------

    getBindingPlan(): MaterialBindingPlan {
        return this.bindingPlan;
    }

    getFactorsPlan(): MaterialFactorsPlan {
        return this.factorsPlan;
    }

    /** Bumped whenever the binding plan or the factors shape changed, i.e. whenever generated shader code is stale. */
    getPlanVersion(): number {
        return this.planVersion;
    }

    // -- the work -----------------------------------------------------------

    ensure(): void {
        if (!this.planDirty && !this.settingsDirty && !this.factorsDirty) return;

        const planWasDirty = this.planDirty;
        const factorsWereDirty = this.factorsDirty;
        const settingsWereDirty = this.settingsDirty;
        this.planDirty = false;
        this.factorsDirty = false;
        this.settingsDirty = false;

        if (planWasDirty) {
            this.bindingPlan = planMaterialBindings(this.owner.getSortedComponents());
            this.planVersion++;
        }

        let bufferReplaced = false;
        if (planWasDirty || factorsWereDirty) {
            const plan = planMaterialFactors(this.owner);
            const shape = factorsShape(plan);
            this.factorsPlan = plan;

            // A factor whose arity changed (vec3 -> vec4) changes offsets and the generated struct: that is a plan change.
            if (!planWasDirty && shape !== this.factorsShapeKey) {
                this.planVersion++;
                this.changed.notify();
            }
            this.factorsShapeKey = shape;

            bufferReplaced = this.syncFactorsBuffer(packFactors(plan));
        }

        if (planWasDirty || bufferReplaced) this.syncBindings();
        if (settingsWereDirty) this.syncSettings();
    }

    /**
     * Writes the packed factors. Returns true when the GPU buffer has to be a different one: a buffer's identity is its
     * uuid and its size is fixed at creation, so a different byte size needs a new BufferInternal (and a new bind group).
     */
    private syncFactorsBuffer(data: Float32Array): boolean {
        const current = this.factorsBuffer;
        if (current && current.getData().byteLength === data.byteLength) {
            current.setData(data.buffer as ArrayBuffer);
            return false;
        }
        this.factorsBuffer = new BufferInternal(data.buffer as ArrayBuffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        return true;
    }

    private syncBindings(): void {
        const bindgroup = this.internal.getBindgroupInteractor();
        const wanted = new Set<number>([FACTORS_BINDING]);

        bindgroup.setUniform(FACTORS_BINDING, this.factorsBuffer!, GPUShaderStage.FRAGMENT);

        for (const component of this.owner.getSortedComponents()) {
            const slot = component.getTexture();
            if (!slot) continue;
            const bindings = this.bindingPlan.byComponent.get(component.name)!;

            if (!wanted.has(bindings.texture)) {
                wanted.add(bindings.texture);
                bindgroup.setTexture(bindings.texture, slot.wrapper.getImage(), GPUShaderStage.FRAGMENT);
            }
            if (!wanted.has(bindings.sampler)) {
                wanted.add(bindings.sampler);
                bindgroup.setSampler(bindings.sampler, slot.wrapper.getSampler(), GPUShaderStage.FRAGMENT);
            }
        }

        for (const binding of this.boundBindings) {
            if (!wanted.has(binding)) bindgroup.removeBinding(binding);
        }
        this.boundBindings = wanted;
    }

    private syncSettings(): void {
        const alphaMode = this.owner.getAlphaMode();
        const isBlend = alphaMode === "blend";
        const settings: MaterialPipelineSettings = {
            cullModes: cullModesOf(alphaMode, this.owner.getDoubleSided()),
            blend: isBlend ? BLEND : undefined,
            depthWriteEnabled: !isBlend,
        };
        const key = stableKey(settings);
        if (key === this.settingsKey) return;
        this.settingsKey = key;
        this.pipelineSettings = settings;
        this.pipelineChanged.notify();
    }
}
