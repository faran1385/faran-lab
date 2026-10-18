import {v4 as uuidv4} from "uuid";

export class VertexLayoutRepresentation {
    readonly uuid: string

    constructor() {
        this.uuid = uuidv4();
    }
}