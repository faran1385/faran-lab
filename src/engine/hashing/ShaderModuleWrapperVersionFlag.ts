import {VersionFlag} from "./VersionFlag.ts";

export class ShaderModuleWrapperVersionFlag {

    private versionFlag: VersionFlag = new VersionFlag();

    constructor() {}

    sync(){
        this.versionFlag.sync()
    }

    addVersion(){
        this.versionFlag.addVersion()
    }

    needsUpdate(){
        return this.versionFlag.needsUpdate()
    }
}