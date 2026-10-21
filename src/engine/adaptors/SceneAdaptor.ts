import {SceneInternal} from "../internals/SceneInternal.ts";
import type {NodeInternal} from "../internals/NodeInternal.ts";
import {schedulePreFrame} from "./PreFrameQueue.ts";
import type {NodeAdaptor} from "./NodeAdaptor.ts";

/**
 * Translates a scene: flattens the node tree under its root into the list of mesh-carrying NodeInternals the renderer
 * draws. It listens to the root's `structureChanged` (nodes added/removed anywhere below it, a mesh assigned), so a
 * scene that did not change costs nothing per frame.
 *
 * World matrices are not computed here: every node adapter brings its own up to date in the same flush.
 */
export class SceneAdaptor {
    readonly internal: SceneInternal;

    private readonly root: NodeAdaptor;
    private readonly task = () => this.ensure();
    private dirty = true;

    constructor(root: NodeAdaptor) {
        this.internal = new SceneInternal();
        this.root = root;
        root.structureChanged.subscribe(this.internal.uuid, () => this.invalidate());
        schedulePreFrame(this.task);
    }

    invalidate(): void {
        this.dirty = true;
        schedulePreFrame(this.task);
    }

    ensure(): void {
        if (!this.dirty) return;
        this.dirty = false;

        const nodes: NodeInternal[] = [];
        const stack: NodeAdaptor[] = [this.root];
        while (stack.length > 0) {
            const adaptor = stack.pop()!;
            if (adaptor.internal.getMesh()) nodes.push(adaptor.internal);
            // reversed so the pops come out in child order
            const children = adaptor.getChildren();
            for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
        }
        this.internal.setNodes(nodes);
    }
}
