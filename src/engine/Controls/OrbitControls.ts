import {vec3} from "../../packages/math/vector/vec3.ts";
import {PerspectiveCamera} from "../Camera/PerspectiveCamera.ts";


export interface OrbitControlsOptions {
    target?: [number, number, number];
    enableDamping?: boolean;
    dampingFactor?: number;     // fraction of remaining motion applied per 1/60 s
    enableRotate?: boolean;
    enableZoom?: boolean;
    enablePan?: boolean;
    rotateSpeed?: number;
    zoomSpeed?: number;
    panSpeed?: number;
    minDistance?: number;
    maxDistance?: number;
    minPolarAngle?: number;     // radians, 0 = straight above the target
    maxPolarAngle?: number;     // radians, PI = straight below it
}

type Mode = "none" | "rotate" | "pan" | "dolly" | "pinch";

const EPS = 1e-6;
const TWO_PI = Math.PI * 2;
const WHEEL_LOG = -Math.log(0.95);          // one 100px wheel notch zooms by 5%
const UP = vec3.fromValues(0, 1, 0);        // assumes a Y-up world, same as Camera's default up

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Orbits a PerspectiveCamera around a target.
 *   left drag / one finger          rotate
 *   right drag / shift+left drag    pan
 *   two fingers                     pinch to zoom + pan
 *   wheel / middle drag             zoom
 * Call update(dt) once per frame, before renderer.render().
 */
export class OrbitControls {
    enabled = true;
    enableDamping: boolean;
    dampingFactor: number;
    enableRotate: boolean;
    enableZoom: boolean;
    enablePan: boolean;
    rotateSpeed: number;
    zoomSpeed: number;
    panSpeed: number;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;

    private readonly target = vec3.create();

    // Pending motion, consumed a fraction at a time by update() (all of it when damping is off).
    private dTheta = 0;                      // azimuth, radians
    private dPhi = 0;                        // polar angle, radians
    private dLog = 0;                        // ln(distance multiplier), so zoom steps compose multiplicatively
    private readonly panOffset = vec3.create();

    // Scratch vectors so pointer moves and update() allocate nothing.
    private readonly fwd = vec3.create();
    private readonly right = vec3.create();
    private readonly camUp = vec3.create();

    private readonly pointers = new Map<number, { x: number; y: number }>();
    private mode: Mode = "none";
    private readonly prevTouchAction: string;
    private readonly camera: PerspectiveCamera
    private readonly element: HTMLElement

    constructor(camera: PerspectiveCamera, element: HTMLElement, options: OrbitControlsOptions = {}) {
        this.camera = camera;
        this.element = element;

        this.enableDamping = options.enableDamping ?? true;
        this.dampingFactor = options.dampingFactor ?? 0.1;
        this.enableRotate = options.enableRotate ?? true;
        this.enableZoom = options.enableZoom ?? true;
        this.enablePan = options.enablePan ?? true;
        this.rotateSpeed = options.rotateSpeed ?? 1;
        this.zoomSpeed = options.zoomSpeed ?? 1;
        this.panSpeed = options.panSpeed ?? 1;
        this.minDistance = options.minDistance ?? 0.01;
        this.maxDistance = options.maxDistance ?? Infinity;
        this.minPolarAngle = options.minPolarAngle ?? 0;
        this.maxPolarAngle = options.maxPolarAngle ?? Math.PI;

        const t = options.target ?? [0, 0, 0];
        vec3.set(this.target, t[0], t[1], t[2]);
        this.camera.lookAt(t[0], t[1], t[2]);

        this.prevTouchAction = element.style.touchAction;
        element.style.touchAction = "none";      // keep the browser from scrolling / zooming the page on touch

        element.addEventListener("pointerdown", this.onPointerDown);
        element.addEventListener("pointermove", this.onPointerMove);
        element.addEventListener("pointerup", this.onPointerUp);
        element.addEventListener("pointercancel", this.onPointerUp);
        element.addEventListener("wheel", this.onWheel, {passive: false});
        element.addEventListener("contextmenu", this.onContextMenu);
    }

    getTarget(): Float32Array {
        return this.target;
    }

    setTarget(x: number, y: number, z: number): void {
        vec3.set(this.target, x, y, z);
    }

    /** Apply pending motion to the camera. Returns true if the camera moved. */
    update(deltaTime = 1 / 60): boolean {
        // Frame-rate independent damping: the same fraction per unit of time at 30, 60 or 144 fps.
        const f = this.enableDamping ? 1 - Math.pow(1 - this.dampingFactor, deltaTime * 60) : 1;

        // Read the orbit state back from the camera, so moving the camera from outside stays consistent.
        const pos = this.camera.getPosition();
        const ox = pos[0] - this.target[0];
        const oy = pos[1] - this.target[1];
        const oz = pos[2] - this.target[2];
        let radius = Math.max(Math.hypot(ox, oy, oz), EPS);
        let theta = Math.atan2(ox, oz);
        let phi = Math.acos(clamp(oy / radius, -1, 1));

        // Apply a fraction of what's pending.
        theta += this.dTheta * f;
        phi = clamp(
            phi + this.dPhi * f,
            Math.max(EPS, this.minPolarAngle),
            Math.min(Math.PI - EPS, this.maxPolarAngle),
        );
        radius = clamp(radius * Math.exp(this.dLog * f), this.minDistance, this.maxDistance);

        const px = this.panOffset[0] * f;
        const py = this.panOffset[1] * f;
        const pz = this.panOffset[2] * f;
        this.target[0] += px;
        this.target[1] += py;
        this.target[2] += pz;

        // Whatever wasn't applied stays pending; snap tiny leftovers to zero so we stop updating.
        const keep = 1 - f;
        this.dTheta = Math.abs(this.dTheta * keep) < EPS ? 0 : this.dTheta * keep;
        this.dPhi = Math.abs(this.dPhi * keep) < EPS ? 0 : this.dPhi * keep;
        this.dLog = Math.abs(this.dLog * keep) < EPS ? 0 : this.dLog * keep;
        vec3.scale(this.panOffset, this.panOffset, keep);
        if (vec3.length(this.panOffset) < EPS) vec3.set(this.panOffset, 0, 0, 0);

        const sinPhi = Math.sin(phi);
        const x = this.target[0] + radius * sinPhi * Math.sin(theta);
        const y = this.target[1] + radius * Math.cos(phi);
        const z = this.target[2] + radius * sinPhi * Math.cos(theta);

        const changed =
            Math.abs(x - pos[0]) > EPS ||
            Math.abs(y - pos[1]) > EPS ||
            Math.abs(z - pos[2]) > EPS ||
            Math.abs(px) + Math.abs(py) + Math.abs(pz) > 0;

        if (changed) {
            this.camera.setPosition(x, y, z);
            this.camera.lookAt(this.target[0], this.target[1], this.target[2]);
        }
        return changed;
    }

    dispose(): void {
        this.element.removeEventListener("pointerdown", this.onPointerDown);
        this.element.removeEventListener("pointermove", this.onPointerMove);
        this.element.removeEventListener("pointerup", this.onPointerUp);
        this.element.removeEventListener("pointercancel", this.onPointerUp);
        this.element.removeEventListener("wheel", this.onWheel);
        this.element.removeEventListener("contextmenu", this.onContextMenu);
        this.element.style.touchAction = this.prevTouchAction;
        this.pointers.clear();
        this.mode = "none";
    }

    // ---- input -> pending motion ----

    private rotate(dx: number, dy: number): void {
        const h = this.element.clientHeight || 1;      // both axes use height, so a drag feels the same in x and y
        this.dTheta -= TWO_PI * dx / h * this.rotateSpeed;
        this.dPhi -= TWO_PI * dy / h * this.rotateSpeed;
    }

    private pan(dx: number, dy: number): void {
        const h = this.element.clientHeight || 1;
        const pos = this.camera.getPosition();

        // Camera basis from the current view direction.
        vec3.sub(this.fwd, this.target, pos);
        const distance = vec3.length(this.fwd);
        vec3.normalize(this.fwd, this.fwd);
        vec3.cross(this.right, this.fwd, UP);
        vec3.normalize(this.right, this.right);
        vec3.cross(this.camUp, this.right, this.fwd);

        // World units per screen pixel at the target's distance.
        const fovRad = this.camera.getFov() * Math.PI / 180;
        const perPixel = 2 * Math.tan(fovRad / 2) * distance / h * this.panSpeed;

        // Dragging right/down drags the scene with the cursor, so the target moves left/up.
        for (let i = 0; i < 3; i++) {
            this.panOffset[i] += -dx * perPixel * this.right[i] + dy * perPixel * this.camUp[i];
        }
    }

    private onPointerDown = (e: PointerEvent): void => {
        if (!this.enabled) return;
        this.element.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});

        if (this.pointers.size === 2) {
            this.mode = "pinch";
            return;
        }
        if (this.pointers.size > 2) return;

        if (e.pointerType === "mouse") {
            if (e.button === 1) this.mode = "dolly";
            else if (e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey) this.mode = "pan";
            else this.mode = "rotate";
        } else {
            this.mode = "rotate";
        }
    };

    private onPointerMove = (e: PointerEvent): void => {
        const p = this.pointers.get(e.pointerId);
        if (!p || !this.enabled) return;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;

        switch (this.mode) {
            case "rotate":
                if (this.enableRotate) this.rotate(dx, dy);
                break;
            case "pan":
                if (this.enablePan) this.pan(dx, dy);
                break;
            case "dolly":
                if (this.enableZoom) this.dLog += dy / (this.element.clientHeight || 1) * 2 * this.zoomSpeed;
                break;
            case "pinch": {
                let other: { x: number; y: number } | undefined;
                for (const [id, q] of this.pointers) if (id !== e.pointerId) other = q;
                if (!other) break;
                const before = Math.hypot(p.x - other.x, p.y - other.y);
                const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
                // fingers apart -> zoom in -> smaller distance
                if (this.enableZoom && before > 0 && after > 0) this.dLog -= Math.log(after / before) * this.zoomSpeed;
                // only one finger reports per event, so the midpoint moved by half of its delta
                if (this.enablePan) this.pan(dx / 2, dy / 2);
                break;
            }
        }

        p.x = e.clientX;
        p.y = e.clientY;
    };

    private onPointerUp = (e: PointerEvent): void => {
        this.pointers.delete(e.pointerId);
        if (this.element.hasPointerCapture(e.pointerId)) this.element.releasePointerCapture(e.pointerId);
        // a finger left after a pinch keeps orbiting; no pointers left means idle
        this.mode = this.pointers.size === 0 ? "none" : "rotate";
    };

    private onWheel = (e: WheelEvent): void => {
        if (!this.enabled || !this.enableZoom) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;      // lines / pages / pixels
        this.dLog += e.deltaY * unit * 0.01 * this.zoomSpeed * WHEEL_LOG;
    };

    private onContextMenu = (e: Event): void => {
        e.preventDefault();      // right drag pans
    };
}