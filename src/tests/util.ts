/** Small seeded RNG (mulberry32), so a failing random run can be replayed from its seed. */
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

    pick<T>(items: readonly T[]): T {
        return items[this.int(items.length)];
    }
}

export type Severity = "fail" | "warn" | "info";

export interface Finding {
    severity: Severity;
    message: string;
}

/** Test-wide knobs, set by run.ts from the query string. */
export const settings = {
    /** Multiplies every "massive" count (nodes, primitives, triangles). `?scale=0.1` for a weak GPU, `?scale=3` for a bigger one. */
    scale: 1,
};

/** `n` scaled by `?scale=`, never below 1. */
export function scaled(n: number): number {
    return Math.max(1, Math.round(n * settings.scale));
}

/**
 * One per scenario.
 *  - `check` is a hard invariant: the engine is wrong if it does not hold (GPU error, leak, a resource that was not
 *    deduplicated, data that did not reach the GPU).
 *  - `warn` is a design / efficiency expectation worth a look that does not make the scenario fail.
 *  - `info` is a plain report line. `perf` also prints it with console.log so the numbers are in the devtools console.
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

    /** A timing / size line: shown on the page and printed with console.log. */
    perf(message: string): void {
        this.findings.push({severity: "info", message});
        console.log(`[${this.name}] ${message}`);
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

export function ms(value: number): string {
    return `${value.toFixed(value < 10 ? 2 : 1)} ms`;
}

export function summarize(values: number[]): { min: number; median: number; p95: number; max: number } {
    const sorted = [...values].sort((a, b) => a - b);
    const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    return {min: sorted[0], median: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1]};
}
