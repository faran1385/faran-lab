import {Source} from "./Source.ts";
import type {ComponentChange} from "./MaterialComponentAdaptor.ts";


export class TextureAdaptor {
    readonly changed = new Source<ComponentChange>();

    connectAdaptor(uuid: string, adaptorFn: (change: ComponentChange) => void) {
        this.changed.subscribe(uuid, adaptorFn);
    }

    disconnectAdaptor(uuid: string) {
        this.changed.unsubscribe(uuid);
    }

    onTextureChange() {
        this.changed.notify("structure");
    }
}