import {ShaderStageRepresentation} from "../Representations/ShaderStageRepresentation.ts";
import {v4 as uuidv4} from "uuid";
import {PrimitiveInternalHashProvider} from "../hashing/PrimitiveInternalHashProvider.ts";
import type {MaterialInternal} from "./MaterialInternal.ts";
import type {GeometryInternal} from "./GeometryInternal.ts";

export class PrimitiveInternal {
    readonly fragment = new ShaderStageRepresentation();
    readonly vertex = new ShaderStageRepresentation();
    readonly uuid: string;

    /**
     * Vertex stages generated for skinned nodes, keyed by the skinning method's id. The plain `vertex` stage has no
     * skinning; which one a node draws with depends on the node's skin, not on the primitive.
     */
    private readonly vertexVariants = new Map<string, ShaderStageRepresentation>();
    /** The geometry carries joints0 and weights0, so a skinned node can deform it. Set by the primitive adaptor. */
    private skinnable = false;

    private mat!: MaterialInternal;
    private geo!: GeometryInternal;
    readonly hashProvider: PrimitiveInternalHashProvider;

    constructor() {
        this.uuid = uuidv4()
        this.hashProvider = new PrimitiveInternalHashProvider({
            getMat: () => this.mat,
            getGeo: () => this.geo,
            getVertex: () => this.vertex,
            getFragment: () => this.fragment,
        });
    }

    isSkinnable(): boolean {
        return this.skinnable;
    }

    setSkinnable(skinnable: boolean): void {
        this.skinnable = skinnable;
    }

    /**
     * The vertex stage a node draws this primitive with. Without a skin (or when the geometry can't be skinned) it is
     * the plain stage. Under a skinning method it is that method's variant, or undefined while it was not generated yet.
     */
    getVertexStage(methodId?: string): ShaderStageRepresentation | undefined {
        if (methodId === undefined || !this.skinnable) return this.vertex;
        return this.vertexVariants.get(methodId);
    }

    getOrCreateVertexVariant(methodId: string): ShaderStageRepresentation {
        let stage = this.vertexVariants.get(methodId);
        if (!stage) {
            stage = new ShaderStageRepresentation();
            this.vertexVariants.set(methodId, stage);
        }
        return stage;
    }

    getMat(): MaterialInternal {
        return this.mat;
    }

    getGeo(): GeometryInternal {
        return this.geo;
    }

    setMat(material: MaterialInternal): void {
        this.mat = material;
        this.hashProvider.markChanged();
    }

    setGeo(geo: GeometryInternal): void {
        this.geo = geo;
        this.hashProvider.markChanged();
    }
}