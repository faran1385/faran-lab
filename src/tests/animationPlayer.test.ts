import {AnimationPlayer} from "../engine/skinning/AnimationPlayer.ts";
import {AnimationClipWrapper} from "../engine/skinning/AnimationClipWrapper.ts";
import {NodeWrapper} from "../engine/wrappers/NodeWrapper.ts";

const near = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) < eps;
let failed = 0;
const check = (name: string, ok: boolean, info = "") => {
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name} ${info}`);
};

const node = new NodeWrapper();
const clip = new AnimationClipWrapper([
    {target: node, path: "translation", sampler: {interpolation: "linear", times: new Float32Array([0, 1, 2]), values: new Float32Array([0,0,0, 10,0,0, 10,20,0])}},
    {target: node, path: "rotation", sampler: {interpolation: "linear", times: new Float32Array([0, 2]), values: new Float32Array([0,0,0,1, 0,Math.SQRT1_2,0,Math.SQRT1_2])}},
    {target: node, path: "scale", sampler: {interpolation: "step", times: new Float32Array([0, 1]), values: new Float32Array([1,1,1, 2,2,2])}},
], 2, "t");

const p = new AnimationPlayer(clip);
p.play();
p.update(0.5);
check("linear t=0.5", near(node.getTranslation()[0], 5), String(node.getTranslation()[0]));
check("step scale before key", near(node.getScale()[0], 1));
p.update(1); // 1.5
check("linear seg2 y", near(node.getTranslation()[1], 10), String(node.getTranslation()[1]));
check("step scale after key", near(node.getScale()[0], 2));
const q = node.getRotation();
check("slerp unit", near(Math.hypot(q[0], q[1], q[2], q[3]), 1));
p.update(1); // 2.5 -> wraps to 0.5
check("repeat wrap", near(p.getTime(), 0.5), String(p.getTime()));
check("backward lookup after wrap", near(node.getTranslation()[0], 5), String(node.getTranslation()[0]));

p.loop = "pingpong"; p.seek(0); p.update(2.5);
check("pingpong reflects", near(p.getTime(), 1.5), String(p.getTime()));

let done = 0;
p.loop = "once"; p.onFinished = () => done++; p.seek(0); p.update(5);
check("once clamps + finishes", near(p.getTime(), 2) && !p.isPlaying() && p.isFinished() && done === 1);
check("end pose", near(node.getTranslation()[1], 20));
p.play(); 
check("restart after finish", near(p.getTime(), 0) && p.isPlaying());

p.loop = "repeat"; p.speed = -1; p.seek(0.25); p.update(0.5);
check("reverse wraps", near(p.getTime(), 1.75), String(p.getTime()));

// cubicspline: zero tangents == smoothstep between values
const n2 = new NodeWrapper();
const c2 = new AnimationClipWrapper([{target: n2, path: "translation", sampler: {interpolation: "cubicspline", times: new Float32Array([0, 1]),
    values: new Float32Array([0,0,0, 0,0,0, 0,0,0,   0,0,0, 4,0,0, 0,0,0])}}], 1);
const p2 = new AnimationPlayer(c2); p2.seek(0.5);
check("cubic midpoint", near(n2.getTranslation()[0], 2), String(n2.getTranslation()[0]));
process.exit(failed ? 1 : 0);
