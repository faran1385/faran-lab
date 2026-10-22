import {PrimitiveInternal} from "../internals/PrimitiveInternal.ts";
import {FragmentShaderProducer, VertexShaderProducer} from "../producers/AssemblerProducers.ts";
import {schedulePreFrame} from "./PreFrameQueue.ts";
import {Source} from "./Source.ts";
import type {FragmentAssemblerBase, VertexAssemblerBase} from "../Assemblers/BaseAssembler.ts";
import type {ShaderStageRepresentation} from "../Representations/ShaderStageRepresentation.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {MaterialAdaptor} from "./MaterialAdaptor.ts";
import type {GeometryAdaptor} from "./GeometryAdaptor.ts";

const VERTEX_ENTRY_POINT = "main";
const FRAGMENT_ENTRY_POINT = "main";

/**
 * Translates a primitive: links its material/geometry internals and fills its vertex/fragment stages (code + entry
 * point) by running the assemblers against the plans its material and geometry adapters already computed.
 *
 * The assemblers run only when something they read changed: the material's binding plan/factors shape, the
 * geometry's vertex layout, the material or geometry being swapped, or an assembler being swapped. A change that
 * only touches pipeline settings (alphaMode, doubleSided) skips code generation and just reaches the nodes.
 */
export class PrimitiveAdaptor {
    readonly internal: PrimitiveInternal;

    /** Shader, geometry, or structure changes require a full pipeline representation sync. */
    readonly changed = new Source<void>();
    /** Material pipeline-state changes can update only this primitive's existing pipeline representations. */
    readonly pipelineChanged = new Source<void>();

    private material: MaterialAdaptor | null = null;
    private geometry: GeometryAdaptor | null = null;
    private vertexAssembler: VertexAssemblerBase | null = null;
    private fragmentAssembler: FragmentAssemblerBase | null = null;

    private readonly task = () => this.ensure();
    private readonly onDependencyChange = () => this.invalidate();
    /** Pipeline-only material changes must reach nodes but must not trigger shader assembly. */
    private readonly onPipelineChange = () => this.pipelineChanged.notify();
    private dirty = true;
    private codeDirty = true;
    private seenPlanVersion = -1;
    private seenLayoutVersion = -1;

    constructor() {
        this.internal = new PrimitiveInternal();
    }

    setMaterial(material: MaterialWrapper): void {
        this.material?.changed.unsubscribe(this.internal.uuid);
        this.material?.pipelineChanged.unsubscribe(this.internal.uuid);
        this.material = material.adaptor;
        this.material.changed.subscribe(this.internal.uuid, this.onDependencyChange);
        this.material.pipelineChanged.subscribe(this.internal.uuid, this.onPipelineChange);
        this.internal.setMat(this.material.internal);
        this.codeDirty = true;
        this.invalidate();
    }

    setGeometry(geometry: GeometryWrapper): void {
        this.geometry?.changed.unsubscribe(this.internal.uuid);
        this.geometry = geometry.adaptor;
        this.geometry.changed.subscribe(this.internal.uuid, this.onDependencyChange);
        this.internal.setGeo(this.geometry.internal);
        this.codeDirty = true;
        this.invalidate();
    }

    getPipelineSettings() {
        return this.material?.getPipelineSettings();
    }

    setAssemblers(vertex: VertexAssemblerBase, fragment: FragmentAssemblerBase): void {
        this.vertexAssembler = vertex;
        this.fragmentAssembler = fragment;
        this.codeDirty = true;
        this.invalidate();
    }

    setVertexAssembler(assembler: VertexAssemblerBase): void {
        this.vertexAssembler = assembler;
        this.codeDirty = true;
        this.invalidate();
    }

    setFragmentAssembler(assembler: FragmentAssemblerBase): void {
        this.fragmentAssembler = assembler;
        this.codeDirty = true;
        this.invalidate();
    }

    invalidate() {
        if (!this.dirty) {
            this.dirty = true;
            this.changed.notify();
        }
        schedulePreFrame(this.task);
    }

    /** Dependencies first (they are idempotent), then this primitive's own work. Safe to call from a node's sync. */
    ensure(): void {
        this.material?.ensure();
        this.geometry?.ensure();

        if (!this.dirty) return;
        this.dirty = false;

        const material = this.material;
        const geometry = this.geometry;
        if (!material || !geometry || !this.vertexAssembler || !this.fragmentAssembler) return;

        const stale = this.codeDirty
            || material.getPlanVersion() !== this.seenPlanVersion
            || geometry.getLayoutVersion() !== this.seenLayoutVersion;
        if (!stale) return;

        this.codeDirty = false;
        this.seenPlanVersion = material.getPlanVersion();
        this.seenLayoutVersion = geometry.getLayoutVersion();

        const bindingPlan = material.getBindingPlan();
        const factorsPlan = material.getFactorsPlan();
        const attributePlan = geometry.getAttributePlan();

        const vertexCode = this.vertexAssembler.assemble(
            VertexShaderProducer.produce(() => bindingPlan, () => attributePlan),
            VERTEX_ENTRY_POINT,
        );
        const fragmentCode = this.fragmentAssembler.assemble(
            FragmentShaderProducer.produce(() => bindingPlan, () => factorsPlan),
            FRAGMENT_ENTRY_POINT,
        );

        this.fillStage(this.internal.vertex, vertexCode, VERTEX_ENTRY_POINT);
        this.fillStage(this.internal.fragment, fragmentCode, FRAGMENT_ENTRY_POINT);
    }

    /** setCode/setEntryPoint always mark the stage changed, so only call them when the value really differs. */
    private fillStage(stage: ShaderStageRepresentation, code: string, entryPoint: string): void {
        if (stage.getEntryPoint() !== entryPoint) stage.setEntryPoint(entryPoint);
        if (stage.getCode() !== code) stage.setCode(code);
    }
}
