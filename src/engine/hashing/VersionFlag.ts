
export class VersionFlag {
    private version = 0;
    private lastSyncedVersion = -1;

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