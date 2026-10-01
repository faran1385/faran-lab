import type {Hasher} from "./utils/Hasher.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";
import {HashHandler} from "./utils/HashHandler.ts";
import {AggregateHashHandler} from "./utils/AggregateHashHandler.ts";
import {VersionFlag} from "./utils/VersionFlag.ts";
import type {MaterialComponentTextureSlot} from "../wrappers/MaterialComponentWrapper.ts";

type InputFunctions = {
    getTexture: () => MaterialComponentTextureSlot | undefined
}

export class MaterialComponentHashProvider {
    private readonly changeStamp = new ChangeStamp();
    private wrapperGetFunctions: InputFunctions
    private shapeHash: HashHandler;
    private shaderKeyHash: HashHandler;
    private resourceHash: AggregateHashHandler;
    private factorVersionFlag = new VersionFlag();

    constructor(T: InputFunctions) {
        this.wrapperGetFunctions = T;

        this.shapeHash = new HashHandler(() => (this.wrapperGetFunctions.getTexture() ? "1" : "0"))
        this.shaderKeyHash = new HashHandler(() => (this.wrapperGetFunctions.getTexture() ? this.wrapperGetFunctions.getTexture()!.texCoord : "0"))
        this.resourceHash = new AggregateHashHandler((hasher) =>
            this.wrapperGetFunctions.getTexture() ? this.wrapperGetFunctions.getTexture()!.wrapper.hashProvider.convertToHash(hasher) : "notex"
        )
    }

    /** Latest change stamp of this component or of its texture. */
    getChangedAt(): number {
        const own = this.changeStamp.get();
        return this.wrapperGetFunctions.getTexture() ? Math.max(own, this.wrapperGetFunctions.getTexture()!.wrapper.hashProvider.getChangedAt()) : own;
    }

    markShaderHash(){
        this.shaderKeyHash.addVersion()
    }

    markShapeHash(){
        this.shapeHash.addVersion()
    }

    markFactorUpdate(){
        this.factorVersionFlag.addVersion()
    }

    convertToShapeHash(hasher: Hasher): string {
        return this.shapeHash.convertToHash(hasher);
    }

    convertToShaderKeyHash(hasher: Hasher): string {
        return this.shaderKeyHash.convertToHash(hasher);
    }

    convertToResourceHash(hasher: Hasher): string {
        return this.resourceHash.convertToHash(hasher);
    }

    needsFactorUpdate() {
        return this.factorVersionFlag.needsUpdate()
    }

    syncFactorUpdate() {
        this.factorVersionFlag.sync()
    }

    markChangeStamp() {
        this.changeStamp.mark();
    }
}