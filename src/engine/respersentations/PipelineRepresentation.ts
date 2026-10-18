import type {PipelineLayoutRepresentation} from "./PipelineLayoutRepresentation.ts";
import {v4 as uuidv4} from "uuid";

export class PipelineRepresentation {
    readonly uuid: string;
    private layout!: PipelineLayoutRepresentation;



    constructor() {
        this.uuid = uuidv4();
    }


}