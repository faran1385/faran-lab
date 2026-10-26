import { v4 as uuidv4 } from "uuid";
import { MaterialInternalHashProvider } from "../hashing/MaterialInternalHashProvider.ts";
import { BindgroupInteractor } from "../Representations/BindgroupInteractor.ts";

/**
 * Renderer-facing material resources only. Pipeline state belongs to the adapter/pipeline representations, not here.
 */
export class MaterialInternal {
    readonly bindgroupInteractor = new BindgroupInteractor();
    readonly group: number;
    readonly uuid: string;
    readonly hashProvider: MaterialInternalHashProvider;

    constructor(group: number = 2) {
        this.group = group;
        this.uuid = uuidv4();
        this.hashProvider = new MaterialInternalHashProvider({
            getGroup: () => this.group,
            getBindgroup: () => this.bindgroupInteractor,
        });
    }
}
