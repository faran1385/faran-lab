import {BindgroupRepresentation} from "../Representations/BindgroupRepresentation.ts";
import {v4 as uuidv4} from "uuid";

export class MaterialInternal {
    private bindgroup = new BindgroupRepresentation();
    private group: number
    readonly uuid: string;

    constructor(group: number = 1) {
        this.group = group;
        this.uuid = uuidv4()
    }

    getGroup(){
        return this.group;
    }

    getBindgroup(){
        return this.bindgroup;
    }
}