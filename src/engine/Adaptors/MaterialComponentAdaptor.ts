import {Source} from "./Source.ts";

/**
 * "structure": a texture slot/component was added or removed, so the binding plan and shader inputs are stale.
 * "resource": an existing texture's image/sampler reference changed; refresh bindings without replanning.
 * "factors": only factor values changed, so the owning material only has to repack its factors buffer.
 */
export type ComponentChange = "structure" | "resource" | "factors";

/**
 * A component can be shared by several materials, so it only broadcasts. Each material adaptor connects itself with
 * its own uuid and decides what the change means for it.
 */
export class MaterialComponentAdaptor {
    readonly changed = new Source<ComponentChange>();

    connectAdaptor(uuid: string, adaptorFn: (change: ComponentChange) => void) {
        this.changed.subscribe(uuid, adaptorFn);
    }

    disconnectAdaptor(uuid: string) {
        this.changed.unsubscribe(uuid);
    }

    onStructureChange() {
        this.changed.notify("structure");
    }

    onFactorsChange() {
        this.changed.notify("factors");
    }

    _onTextureChange() {
        this.changed.notify("resource")
    }

    onTextureChange = this._onTextureChange.bind(this);

}
