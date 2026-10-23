import {stressScenarios} from "./stress.ts";
import {changeScenarios} from "./changes.ts";
import {type Finding, type Scenario, settings, TestCtx} from "./util.ts";

/**
 * Test page entry (open /tests.html). Query parameters:
 *   ?only=a,b    run only scenarios whose name contains one of these (e.g. ?only=massive,high-level)
 *   ?scale=0.2   multiplies every "massive" count (default 1); use a small value on a weak GPU
 *   ?stress=0    skip the massive-scene scenarios
 *   ?changes=0   skip the change-trigger scenarios
 * Timing lines are printed with console.log (devtools console) and shown on the page.
 * Results are also published on window.__results and window.__done for automation.
 */

interface Result {
    name: string;
    description: string;
    status: "pass" | "warn" | "fail" | "error";
    ms: number;
    findings: Finding[];
    error?: string;
}

declare global {
    interface Window {
        __results?: Result[];
        __done?: boolean;
    }
}

const params = new URLSearchParams(location.search);
const only = params.get("only")?.split(",").filter(Boolean) ?? [];
settings.scale = Number(params.get("scale") ?? 1) || 1;

const all: Scenario[] = [
    ...(params.get("changes") === "0" ? [] : changeScenarios),
    ...(params.get("stress") === "0" ? [] : stressScenarios),
];
const selected = only.length > 0 ? all.filter((s) => only.some((o) => s.name.includes(o))) : all;

const summary = document.getElementById("summary")!;
const list = document.getElementById("results")!;
const host = document.getElementById("rigs")!;

const results: Result[] = [];
window.__results = results;

function escapeHtml(s: string): string {
    return s.replace(/[&<>]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"}[c]!));
}

function render(): void {
    const count = (status: Result["status"]) => results.filter((r) => r.status === status).length;
    summary.textContent = `${results.length}/${selected.length} done: ${count("pass")} passed, ${count("warn")} with warnings, ${count("fail") + count("error")} failed`;
    list.innerHTML = results.map((r) => `
        <details class="${r.status}" ${r.status === "pass" ? "" : "open"}>
            <summary><b>${r.status.toUpperCase()}</b> ${escapeHtml(r.name)} <small>${Math.round(r.ms)} ms</small></summary>
            <p class="desc">${escapeHtml(r.description)}</p>
            ${r.error ? `<pre class="fail">${escapeHtml(r.error)}</pre>` : ""}
            ${r.findings.map((f) => `<pre class="${f.severity}">${f.severity}: ${escapeHtml(f.message)}</pre>`).join("")}
        </details>`).join("");
}

async function main(): Promise<void> {
    if (!navigator.gpu) {
        summary.textContent = "WebGPU is not available in this browser.";
        window.__done = true;
        return;
    }

    for (const scenario of selected) {
        const ctx = new TestCtx(scenario.name, host);
        const started = performance.now();
        let error: string | undefined;
        try {
            await scenario.run(ctx);
        } catch (e) {
            error = e instanceof Error ? (e.stack ?? e.message) : String(e);
        } finally {
            ctx.cleanup();
        }

        const status: Result["status"] = error ? "error"
            : ctx.failed ? "fail"
                : ctx.findings.some((f) => f.severity === "warn") ? "warn" : "pass";
        results.push({
            name: scenario.name, description: scenario.description, status,
            ms: performance.now() - started, findings: ctx.findings, error,
        });
        render();
        await new Promise((r) => setTimeout(r));
    }

    window.__done = true;
    console.info("renderer tests finished", results.map((r) => `${r.status} ${r.name}`));
}

void main();
