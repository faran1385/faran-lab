import {VersionFlag} from "./utils/VersionFlag.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";
import type {MeshWrapper} from "../wrappers/MeshWrapper.ts";

type InputFunctions = {
    getMesh: () => MeshWrapper | undefined,
}

export class NodeHashProvider {
    private readonly transformFlag = new VersionFlag();
    private readonly meshStamp = new ChangeStamp();
    /** Skin assigned / removed: changes the node's bind group layout and its primitives' shaders, like a mesh swap. */
    private readonly skinStamp = new ChangeStamp();

    private wrapperFunctions: InputFunctions;

    constructor(T: InputFunctions) {
        this.wrapperFunctions = T;

    }

    getStructureChangedAt(): number {
        const own = Math.max(this.meshStamp.get(), this.skinStamp.get());
        return this.wrapperFunctions.getMesh() ? Math.max(own, this.wrapperFunctions.getMesh()!.hashProvider.getChangedAt()) : own;
    }

    markTransform() {
        this.transformFlag.addVersion()
    }

    transformNeedsUpdate() {
        return this.transformFlag.needsUpdate()
    }

    syncTransformUpdate() {
        this.transformFlag.sync()
    }


    markMesh() {
        this.meshStamp.mark()
    }

    markSkin() {
        this.skinStamp.mark()
    }
}