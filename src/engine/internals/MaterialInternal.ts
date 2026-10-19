import {BindgroupRepresentation} from "../Representations/BindgroupRepresentation.ts";
import {v4 as uuidv4} from "uuid";
import {MaterialInternalHashProvider} from "../hashing/MaterialInternalHashProvider.ts";

export class MaterialInternal {
    private bindgroup = new BindgroupRepresentation();
    private group: number
    readonly uuid: string;
    readonly hashProvider: MaterialInternalHashProvider;

    constructor(group: number = 1) {
        this.group = group;
        this.uuid = uuidv4()
        this.hashProvider = new MaterialInternalHashProvider({
            getGroup: () => this.group,
            getBindgroup: () => this.bindgroup,
        });
    }

    getGroup(){
        return this.group;
    }

    getBindgroup(){
        return this.bindgroup;
    }
}