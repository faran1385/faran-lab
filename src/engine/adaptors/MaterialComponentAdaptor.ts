export class MaterialComponentAdaptor {
    private connectedAdaptors = new Map<string, (name: string) => void>();
    private name: string;

    constructor(name: string) {
        this.name = name;
    }


    connectAdaptor(uuid: string, adaptorFn: (name: string) => void) {
        this.connectedAdaptors.set(uuid, adaptorFn);
    }

    disconnectAdaptor(uuid: string) {
        this.connectedAdaptors.delete(uuid);
    }

    onChange() {
        this.connectedAdaptors.forEach(fn => fn(this.name))
    }
}