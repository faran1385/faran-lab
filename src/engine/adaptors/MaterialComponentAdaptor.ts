export class MaterialComponentAdaptor {
    private connectedAdaptors = new Map<string, () => void>();

    connectAdaptor(uuid: string, adaptorFn: () => void) {
        this.connectedAdaptors.set(uuid, adaptorFn);
    }

    disconnectAdaptor(uuid: string) {
        this.connectedAdaptors.delete(uuid);
    }

    onChange() {
        this.connectedAdaptors.forEach(fn => fn())
    }
}