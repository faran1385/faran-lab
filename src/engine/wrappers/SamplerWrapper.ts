import type {Sampler} from "../importers/utils/IR.ts";
import {v4 as uuidv4} from "uuid";

export class SamplerWrapper {

    private minFilter: Sampler["minFilter"]
    private magFilter: Sampler["magFilter"]
    private mipFilter: Sampler["mipFilter"]
    private addressModeU: Sampler["addressModeU"]
    private addressModeV: Sampler["addressModeV"]
    readonly uuid: string;

    constructor(minFilter: Sampler["minFilter"], magFilter: Sampler["magFilter"], mipFilter: Sampler["mipFilter"], addressModeU: Sampler["addressModeU"], addressModeV: Sampler["addressModeV"]) {
        this.minFilter = minFilter;
        this.magFilter = magFilter;
        this.mipFilter = mipFilter;
        this.addressModeU = addressModeU;
        this.addressModeV = addressModeV;

        this.uuid = uuidv4();
    }

}