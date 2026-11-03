import type {SkinWrapper} from "./SkinWrapper.ts";
import type {MorphStateWrapper} from "./MorphStateWrapper.ts";

/**
 * Everything Animation-related a node carries, kept out of NodeWrapper itself. Today that is the skin the node's mesh is
 * skinned with. Setting, replacing or removing it goes through `onSkinChange`, which the owning node uses to update
 * its adapter (palette binding, vertex shader).
 */
export class AnimationHandler {
    private skin?: SkinWrapper;
    private readonly onSkinChange: (skin: SkinWrapper | undefined) => void;
    private morphState: MorphStateWrapper | null = null;
    private readonly onMorphStateChange: (state: MorphStateWrapper | null) => void;


    constructor(onSkinChange: AnimationHandler["onSkinChange"], onMorphStateChange: AnimationHandler["onMorphStateChange"]) {
        this.onMorphStateChange = onMorphStateChange
        this.onSkinChange = onSkinChange;
    }

    /**
     * The morph weights of this node, for the morph targets of its mesh's geometries. Without one, morphed geometry
     * draws its rest pose. Two nodes that share a mesh can have different states.
     */
    setMorphState(state: MorphStateWrapper | null) {
        this.morphState = state;
        this.onMorphStateChange(state);
    }


    getMorphState() {
        return this.morphState;
    }

    getSkin(): SkinWrapper | undefined {
        return this.skin;
    }

    setSkin(skin: SkinWrapper | undefined): void {
        if (this.skin === skin) return;
        this.skin = skin;
        this.onSkinChange(skin);
    }
}
