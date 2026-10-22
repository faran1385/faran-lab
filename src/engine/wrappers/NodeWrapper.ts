import type {MeshWrapper} from "./MeshWrapper.ts";
import type {Node} from "../importers/utils/IR.ts";
import {v4 as uuidv4} from "uuid";
import {vec3} from "../../packages/math/vector/vec3.ts";
import {quat} from "../../packages/math/quat/quat.ts";
import {NodeAdaptor} from "../Adaptors/NodeAdaptor.ts";

export class NodeWrapper {
    readonly adaptor: NodeAdaptor;
    readonly uuid: string;
    private name?: string;
    private mesh: MeshWrapper | null = null;
    private children = new Map<string, NodeWrapper>();
    private parent?: NodeWrapper;

    private translation: Float32Array;
    private rotation: Float32Array;
    private scale: Float32Array;

    private _cachedChildrenArray: NodeWrapper[] = []


    /**
     * @param adaptor pass one to customise the node's internal. The default exposes the world matrix at group 2,
     * binding 0 (vertex stage), which is what the built-in assemblers declare.
     */
    constructor(
        adaptor?: NodeAdaptor,
        translation?: Node["translation"],
        rotation?: Node["rotation"],
        scale?: Node["scale"],
        name?: string,
    ) {
        this.adaptor = adaptor ?? new NodeAdaptor();

        if (!adaptor) this.adaptor.internal.getPipelines().forEach(pipeline => pipeline.forEach((p) => {
            this.adaptor.setBindingGroup(p, "scene", 0);
            this.adaptor.setBindingGroup(p, "node", 1)
        }))

        const t = translation ?? [0, 0, 0] as any;
        const r = rotation ?? [0, 0, 0, 1] as any;
        const s = scale ?? [1, 1, 1] as any;

        this.uuid = uuidv4();
        this.name = name;
        this.scale = vec3.fromValues(s[0], s[1], s[2]);
        this.translation = vec3.fromValues(t[0], t[1], t[2]);
        this.rotation = quat.fromValues(r[0], r[1], r[2], r[3]);
        this.adaptor.setSource(this);
    }

    private updateCachedChildren() {
        this._cachedChildrenArray = Array.from(this.children.values())
    }

    getMesh() {
        return this.mesh;
    }

    setMesh(mesh: MeshWrapper | null) {
        this.mesh = mesh;
        this.adaptor.setMesh(mesh)
    }

    setName(name: string | undefined) {
        this.name = name;
    }

    getName() {
        return this.name;
    }

    getTranslation() {
        return this.translation;
    }

    setTranslation(tx: number, ty: number, tz: number) {
        vec3.set(this.translation, tx, ty, tz);
        this.adaptor.invalidateWorld();
    }

    getRotation() {
        return this.rotation;
    }

    setRotation(x: number, y: number, z: number) {
        quat.fromEuler(this.rotation, x, y, z)
        this.adaptor.invalidateWorld();
    }

    getScale() {
        return this.scale;
    }

    setScale(sx: number, sy: number, sz: number) {
        vec3.set(this.scale, sx, sy, sz);
        this.adaptor.invalidateWorld();
    }

    addChild(child: NodeWrapper) {
        if (child.parent) {
            child.parent.removeChild(child);
        }
        child.parent = this;
        this.children.set(child.uuid, child);
        this.adaptor.addChild(child.adaptor);
        this.updateCachedChildren();
    }

    removeChild(child: NodeWrapper) {
        if (this.children.delete(child.uuid)) {
            child.parent = undefined;
            this.adaptor.removeChild(child.adaptor);
            this.updateCachedChildren();
        }
    }

    getParent() {
        return this.parent;
    }

    getChildren() {
        return this._cachedChildrenArray;
    }

    /** The world matrix as of the last flush of the pre-frame queue. */
    getWorldMatrix() {
        return this.adaptor.getWorldMatrix();
    }
}
