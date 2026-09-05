import {v4 as uuidv4} from "uuid";

import type {Hasher} from "../hashing/Hasher.ts";
import type {BindGroupEntry} from "../descriptorProducer/ShaderDescriptorProducer.ts";
import {hashBindGroupEntry} from "../descriptorProducer/utils.ts";
import {HashHandler} from "../hashing/HashHandler.ts";


export abstract class ShaderModuleWrapper {
    readonly uuid: string;

    protected hashHandler: HashHandler;
    private entryPoint = "main";

    constructor() {
        this.uuid = uuidv4();
        this.hashHandler = new HashHandler(() => this.buildHashKey());
    }

    protected bumpVersion(): void {
        this.hashHandler.addVersion();
    }

    protected static hashBindings(entries: BindGroupEntry[]): string {
        return entries.map(hashBindGroupEntry).join(",");
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }

    drainTrash(): string[] {
        return this.hashHandler.drainTrash();
    }

    setEntryPoint(entryPoint: string): void {
        this.entryPoint = entryPoint;
        this.bumpVersion();
    }

    getEntryPoint() {
        return this.entryPoint;
    }

    protected abstract buildHashKey(): string;
}

