import {v4 as uuidv4} from "uuid";

import type {Hasher} from "../hashing/Hasher.ts";
import {HashHandler} from "../hashing/HashHandler.ts";
import {ShaderModuleWrapperVersionFlag} from "../hashing/ShaderModuleWrapperVersionFlag.ts";

export class ShaderModuleWrapper {
    readonly uuid: string;

    protected hashHandler: HashHandler;
    readonly codeGenVersionFlag = new ShaderModuleWrapperVersionFlag();
    private entryPoint = "main";
    private code: string = "";

    constructor() {
        this.uuid = uuidv4();
        this.hashHandler = new HashHandler(() => this.buildHashKey());
    }



    setShader(code: string, entryPoint: string): void {
        this.code = code;
        this.entryPoint = entryPoint;
        this.hashHandler.addVersion();
    }

    getCode(): string {
        return this.code;
    }

    protected buildHashKey(): string {
        return this.code;
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }

    getEntryPoint() {
        return this.entryPoint;
    }
}

