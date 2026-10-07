/** Small seeded RNG (mulberry32), so a failing fuzz run can be replayed from its seed. */
export class Rng {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
    }

    next(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    int(maxExclusive: number): number {
        return Math.floor(this.next() * maxExclusive);
    }

    chance(p: number): boolean {
        return this.next() < p;
    }

    pick<T>(items: readonly T[]): T {
        return items[this.int(items.length)];
    }
}

export type Severity = "fail" | "warn" | "info";

export interface Finding {
    severity: Severity;
    message: string;
}

/**
 * One per scenario. `check` is a hard invariant (the engine is wrong if it does not hold), `warn` is an efficiency
 * or design expectation that is worth looking at but does not make the scenario fail.
 */
export class TestCtx {
    readonly name: string;
    readonly host: HTMLElement;
    readonly findings: Finding[] = [];
    private disposers: Array<() => void> = [];

    constructor(name: string, host: HTMLElement) {
        this.name = name;
        this.host = host;
    }

    onCleanup(fn: () => void): void {
        this.disposers.push(fn);
    }

    cleanup(): void {
        for (const d of this.disposers) {
            try {
                d();
            } catch {
                // best effort
            }
        }
        this.disposers = [];
    }

    check(condition: unknown, message: string): boolean {
        if (!condition) this.findings.push({severity: "fail", message});
        return !!condition;
    }

    fail(message: string): void {
        this.findings.push({severity: "fail", message});
    }

    warn(condition: unknown, message: string): boolean {
        if (!condition) this.findings.push({severity: "warn", message});
        return !!condition;
    }

    info(message: string): void {
        this.findings.push({severity: "info", message});
    }

    get failed(): boolean {
        return this.findings.some((f) => f.severity === "fail");
    }
}

export type Scenario = {
    name: string;
    description: string;
    run: (ctx: TestCtx) => Promise<void>;
};
