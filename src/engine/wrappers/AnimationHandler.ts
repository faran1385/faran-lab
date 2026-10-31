import type {SkinWrapper} from "./SkinWrapper.ts";

/**
 * Everything animation-related a node carries, kept out of NodeWrapper itself. Today that is the skin the node's mesh is
 * skinned with. Setting, replacing or removing it goes through `onSkinChange`, which the owning node uses to update
 * its adapter (palette binding, vertex shader).
 */
export class AnimationHandler {
    private skin?: SkinWrapper;
    private readonly onSkinChange: (skin: SkinWrapper | undefined) => void;

    constructor(onSkinChange: (skin: SkinWrapper | undefined) => void) {
        this.onSkinChange = onSkinChange;
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
