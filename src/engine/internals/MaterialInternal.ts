import { v4 as uuidv4 } from "uuid";
import { MaterialInternalHashProvider } from "../hashing/MaterialInternalHashProvider.ts";
import { BindgroupInteractor } from "../Representations/BindgroupInteractor.ts";

export class MaterialInternal {
    private bindgroupInteractor = new BindgroupInteractor();
    private group: number;
    readonly uuid: string;
    readonly hashProvider: MaterialInternalHashProvider;

    constructor(group: number = 1) {
        this.group = group;
        this.uuid = uuidv4();
        this.hashProvider = new MaterialInternalHashProvider({
            getGroup: () => this.group,
            getBindgroup: () => this.bindgroupInteractor,
        });
    }

    getGroup() {
        return this.group;
    }

    getBindgroupInteractor() {
        return this.bindgroupInteractor;
    }
}
