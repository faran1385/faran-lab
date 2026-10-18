import {BindgroupRepresentation} from "../Representations/BindgroupRepresentation.ts";

export class MaterialInternal {
    private bindgroup = new BindgroupRepresentation();
    private group: number

    constructor(group: number = 1) {
        this.group = group;
    }

    getGroup(){
        return this.group;
    }

    getBindgroup(){
        return this.bindgroup;
    }
}