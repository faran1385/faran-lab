export class VersionFlag {
    private version = 0;
    private lastSyncedVersion = -1;

    constructor(needsUpdateAtFirst: boolean = true) {
        needsUpdateAtFirst ? this.lastSyncedVersion = -1 : this.lastSyncedVersion = 0
    }

    addVersion(): void {
        this.version++;
    }

    needsUpdate(): boolean {
        return this.version !== this.lastSyncedVersion;
    }

    sync(): void {
        this.lastSyncedVersion = this.version;
    }
}