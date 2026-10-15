import {v4 as uuidv4} from "uuid";
import type {SkinInstanceWrapper} from "../skinning/SkinInstanceWrapper.ts";

/**
 * Everything animation-related a node can carry, kept out of NodeWrapper itself. Today that is the skin instance the
 * node's mesh is skinned with; the animation player will hang its state here later.
 *
 * `onChange` is how the owning node learns that something render-relevant changed. NodeWrapper passes a callback that
 * stamps its hash provider, so assigning or removing a skin goes through the epoch like a mesh swap does.
 */
export class NodeAnimationHandler {
    readonly uuid: string;

    private skinInstance?: SkinInstanceWrapper;
    private readonly onChange: () => void;

    constructor(onChange: () => void) {
        this.uuid = uuidv4();
        this.onChange = onChange;
    }

    getSkinInstance(): SkinInstanceWrapper | undefined {
        return this.skinInstance;
    }

    setSkinInstance(skinInstance: SkinInstanceWrapper | undefined): void {
        if (this.skinInstance === skinInstance) return;
        this.skinInstance = skinInstance;
        this.onChange();
    }
}
