"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { OrbitalElements } from "../../../domain/asteroid";
import {
  EARTH_ELEMENTS,
  JUPITER_ELEMENTS,
  MARS_ELEMENTS,
  positionAt,
  positionFromMeanAnomaly,
  type Vec3,
} from "../../../domain/physics";

/** Asteroid hovered under the cursor, with canvas-relative pixel coordinates. */
export interface HoverInfo {
  el: OrbitalElements;
  x: number;
  y: number;
}

export interface OrbitalCanvasProps {
  orbits: OrbitalElements[];
  playing: boolean;
  /** Simulation speed in days per real second. */
  speedDaysPerSec: number;
  /** Non-null jumps the clock to the given day offset. */
  seek: { days: number } | null;
  /** Id of the currently selected body (its orbit + marker are drawn). */
  selectedId: string | null;
  /** Draw the full orbit of every sampled asteroid as a faint web. */
  showAllOrbits: boolean;
  /** Bumping this number flies the camera to the currently selected body. */
  flyNonce: number;
  /** When true, the camera tours random bodies on its own (exhibition mode). */
  autoTour: boolean;
  /** Throttled report of current sim time + simulated close encounters. */
  onReport: (days: number, encounters: number) => void;
  /** Click on a body → that body (or null when clicking empty space). */
  onSelect: (el: OrbitalElements | null) => void;
  /** Hover over a body → tooltip info (or null when leaving one). */
  onHover: (info: HoverInfo | null) => void;
}

const ENCOUNTER_AU = 0.05; // PHA-grade closeness for the simulated counter
const SELECT_COLOR = 0xfde047; // bright yellow — highlight for the selection
const DRAG_PX = 6; // pointer travel above which a click counts as a drag (rotation)
const ALL_ORBIT_SEGMENTS = 72; // line segments per orbit in the "all orbits" web
const FLY_DURATION = 2.4; // seconds for a cinematic camera approach
const TOUR_DWELL = 7; // seconds the auto-tour lingers on each body
const FRAMING_DIST = 1.3; // camera distance (AU) from the body when arriving

/** Map ecliptic (x, y, z) AU → three.js scene coords (belt in the X–Z plane). */
function toScene(p: Vec3): [number, number, number] {
  return [p.x, p.z, p.y];
}

/** Per-class colour, shared by the point cloud and the orbit web. */
function classRGB(el: OrbitalElements, c: THREE.Color): THREE.Color {
  if (el.pha) return c.setRGB(1.0, 0.36, 0.42); // rose-red — danger
  if (el.className === "MBA" || el.className === "OMB" || el.className === "IMB")
    return c.setRGB(0.62, 0.72, 0.95); // cool periwinkle — main belt
  return c.setRGB(0.28, 0.8, 1.0); // cyan — NEO / others
}

/**
 * Imperative Three.js belt: a Points cloud of sampled asteroids propagated with
 * Kepler's equation, a glowing Sun, the inner planets and their orbits, with
 * UnrealBloom for an exhibition-grade look. Bodies are clickable (raycast pick)
 * and the selected one gets its full orbit + a pulsing reticle. The whole
 * sample's orbits can be revealed as a faint web. Client-only (`ssr: false`).
 */
export function OrbitalCanvas(props: OrbitalCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Latest props mirrored into refs so the single animation loop reads them.
  const playingRef = useRef(props.playing);
  const speedRef = useRef(props.speedDaysPerSec);
  const onReportRef = useRef(props.onReport);
  const onSelectRef = useRef(props.onSelect);
  const onHoverRef = useRef(props.onHover);
  useEffect(() => {
    playingRef.current = props.playing;
    speedRef.current = props.speedDaysPerSec;
    onReportRef.current = props.onReport;
    onSelectRef.current = props.onSelect;
    onHoverRef.current = props.onHover;
  });

  const timeRef = useRef(0);
  const elementsRef = useRef<OrbitalElements[]>(props.orbits);
  const positionsRef = useRef<Float32Array | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const dotTexRef = useRef<THREE.CanvasTexture | null>(null);

  // Planets animated along their orbits, plus the labels that ride with them.
  const planetsRef = useRef<{ mesh: THREE.Mesh; el: typeof EARTH_ELEMENTS }[]>([]);
  const labelsRef = useRef<{ sprite: THREE.Sprite; w: number; h: number }[]>([]);

  // The full-sample orbit web (built lazily when toggled on).
  const allOrbitsRef = useRef<THREE.LineSegments | null>(null);

  // Selection artefacts (orbit line + marker + reticle), rebuilt on change.
  const selectedElRef = useRef<OrbitalElements | null>(null);
  const selOrbitRef = useRef<THREE.LineLoop | null>(null);
  const selMarkerRef = useRef<THREE.Mesh | null>(null);
  const selReticleRef = useRef<THREE.Sprite | null>(null);
  const reticleTexRef = useRef<THREE.CanvasTexture | null>(null);

  // Cinematic camera: a fly-to tween, an auto-tour dwell, and imperative hooks
  // the React effects call to start/stop them.
  const autoTourRef = useRef(false);
  const flyRef = useRef<{
    t: number;
    from: THREE.Vector3;
    fromTarget: THREE.Vector3;
    el: OrbitalElements;
  } | null>(null);
  const dwellRef = useRef<{ t: number; last: THREE.Vector3 } | null>(null);
  const startFlyRef = useRef<((el: OrbitalElements) => void) | null>(null);
  const tourStepRef = useRef<(() => void) | null>(null);
  const stopTourRef = useRef<(() => void) | null>(null);

  // Apply seeks.
  useEffect(() => {
    if (props.seek) timeRef.current = props.seek.days;
  }, [props.seek]);

  // One-time scene setup + animation loop.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.01,
      4000,
    );
    camera.position.set(0, 5.5, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.cursor = "grab";
    container.appendChild(renderer.domElement);

    // Postprocessing: bloom makes the Sun and bright markers glow. Guarded so a
    // failure to build the composer degrades to a plain render.
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.75, // strength
        0.55, // radius
        0.85, // threshold — high so only the Sun/markers glow, not the whole belt
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    } catch {
      composer = null;
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.6;
    controls.maxDistance = 120;
    controls.maxPolarAngle = Math.PI * 0.95;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.35;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sunLight = new THREE.PointLight(0xfff0c0, 2.6, 0, 0.4);
    scene.add(sunLight);

    // Shared canvas textures.
    dotTexRef.current = makeAsteroidTexture();
    reticleTexRef.current = makeReticleTexture();
    const glowTex = makeGlowTexture();

    // Sun: a bright core with layered additive glows (lit up further by bloom).
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff1cc }),
    );
    scene.add(sun);
    const makeGlow = (scale: number, color: number, opacity: number) => {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      s.scale.setScalar(scale);
      scene.add(s);
      return s;
    };
    const sunGlowInner = makeGlow(1.4, 0xffe1a0, 0.85);
    const sunGlowOuter = makeGlow(2.6, 0xffb45c, 0.3);

    // Reference orbits drawn from real elements (ellipses), plus belt annuli.
    const orbitRing = (el: typeof EARTH_ELEMENTS, color: number, opacity: number) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 220; k++) {
        pts.push(new THREE.Vector3(...toScene(positionFromMeanAnomaly(el, (k / 220) * 360))));
      }
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
      );
      scene.add(line);
    };
    const circleRing = (radius: number, color: number, opacity: number) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 128; k++) {
        const t = (k / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius));
      }
      scene.add(
        new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
        ),
      );
    };
    circleRing(2.1, 0x8c9ed1, 0.14); // belt inner
    circleRing(3.3, 0x8c9ed1, 0.14); // belt outer
    orbitRing(EARTH_ELEMENTS, 0x4f9bff, 0.55);
    orbitRing(MARS_ELEMENTS, 0xfb923c, 0.45);
    orbitRing(JUPITER_ELEMENTS, 0xa855f7, 0.4);

    // Planets (exaggerated radii so they read at this scale).
    const planet = (
      radius: number,
      color: number,
      emissive: number,
      el: typeof EARTH_ELEMENTS,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 24, 24),
        new THREE.MeshStandardMaterial({
          color,
          emissive,
          emissiveIntensity: 0.6,
          roughness: 0.8,
          metalness: 0.0,
        }),
      );
      scene.add(mesh);
      planetsRef.current.push({ mesh, el });
      return mesh;
    };
    const earth = planet(0.07, 0x4f9bff, 0x1a3a6b, EARTH_ELEMENTS);
    const mars = planet(0.058, 0xc1440e, 0x4a1605, MARS_ELEMENTS);
    const jupiter = planet(0.135, 0xd9b483, 0x4a3a23, JUPITER_ELEMENTS);

    // Labels (constant on-screen size; positions tracked each frame).
    labelsRef.current = [];
    const addLabel = (text: string, color: string, parent: THREE.Object3D, y: number) => {
      const { sprite, w, h } = makeLabel(text, color);
      sprite.position.set(0, y, 0);
      parent.add(sprite);
      labelsRef.current.push({ sprite, w, h });
    };
    // A small anchor at the Sun so its label can ride a child like the planets.
    const sunAnchor = new THREE.Object3D();
    scene.add(sunAnchor);
    addLabel("Sol", "#ffe6a8", sunAnchor, 0.42);
    addLabel("Tierra", "#9cc4ff", earth, 0.2);
    addLabel("Marte", "#fdba74", mars, 0.2);
    addLabel("Júpiter", "#c4a3f5", jupiter, 0.3);

    buildPoints(scene, elementsRef.current, dotTexRef.current, pointsRef, positionsRef);

    // Interaction: raycast the point cloud.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const pickIndex = (e: MouseEvent): number => {
      const points = pointsRef.current;
      if (!points) return -1;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const dist = camera.position.distanceTo(controls.target);
      if (raycaster.params.Points) {
        raycaster.params.Points.threshold = Math.max(0.04, dist * 0.012);
      }
      const hits = raycaster.intersectObject(points, false);
      return hits.length && hits[0].index != null ? hits[0].index : -1;
    };

    const onPointerDown = (e: MouseEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      renderer.domElement.style.cursor = "grabbing";
    };
    const onPointerUp = () => {
      renderer.domElement.style.cursor = "grab";
    };
    const onClick = (e: MouseEvent) => {
      if (autoTourRef.current) return; // the tour drives the camera; ignore clicks
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > DRAG_PX) return;
      const idx = pickIndex(e);
      const el = idx >= 0 ? elementsRef.current[idx] ?? null : null;
      onSelectRef.current(el);
    };
    const onMove = (e: MouseEvent) => {
      if (e.buttons !== 0) return;
      const idx = pickIndex(e);
      if (idx >= 0) {
        const el = elementsRef.current[idx];
        const rect = renderer.domElement.getBoundingClientRect();
        renderer.domElement.style.cursor = "pointer";
        onHoverRef.current({ el, x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        renderer.domElement.style.cursor = "grab";
        onHoverRef.current(null);
      }
    };
    const onLeave = () => {
      onHoverRef.current(null);
      renderer.domElement.style.cursor = "grab";
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("mousemove", onMove);
    renderer.domElement.addEventListener("mouseleave", onLeave);

    // Resize
    const resize = () => {
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // ───────── Cinematic camera (fly-to + auto-tour) ─────────
    const flyAst = new THREE.Vector3();
    const flyDest = new THREE.Vector3();
    // Fixed approach angle (up and to the side) scaled to the framing distance.
    const flyOffset = new THREE.Vector3(0.55, 0.42, 0.72)
      .normalize()
      .multiplyScalar(FRAMING_DIST);
    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const astScene = (el: OrbitalElements, d: number, out: THREE.Vector3) => {
      const p = positionAt(el, d);
      return out.set(p.x, p.z, p.y);
    };

    const startFly = (el: OrbitalElements) => {
      flyRef.current = {
        t: 0,
        from: camera.position.clone(),
        fromTarget: controls.target.clone(),
        el,
      };
      dwellRef.current = null;
      controls.enabled = false;
      controls.autoRotate = false;
    };

    const pickRandom = (): OrbitalElements | null => {
      const els = elementsRef.current;
      if (!els.length) return null;
      let el = els[Math.floor(Math.random() * els.length)];
      for (let k = 0; k < 5 && el.id === selectedElRef.current?.id; k++) {
        el = els[Math.floor(Math.random() * els.length)];
      }
      return el;
    };

    const tourStep = () => {
      const el = pickRandom();
      if (!el) return;
      onSelectRef.current(el); // React selection → draws its orbit + info card
      startFly(el);
    };

    const stopTour = () => {
      flyRef.current = null;
      dwellRef.current = null;
      controls.autoRotate = false;
      controls.enabled = true;
    };

    startFlyRef.current = startFly;
    tourStepRef.current = tourStep;
    stopTourRef.current = stopTour;

    const updateCamera = (dt: number, days: number) => {
      const fly = flyRef.current;
      if (fly) {
        fly.t = Math.min(1, fly.t + dt / FLY_DURATION);
        const e = easeInOut(fly.t);
        astScene(fly.el, days, flyAst);
        flyDest.copy(flyAst).add(flyOffset);
        camera.position.lerpVectors(fly.from, flyDest, e);
        controls.target.lerpVectors(fly.fromTarget, flyAst, e);
        camera.lookAt(controls.target);
        if (fly.t >= 1) {
          flyRef.current = null;
          if (autoTourRef.current) {
            dwellRef.current = { t: 0, last: flyAst.clone() };
            controls.autoRotate = true; // slow orbit around the body while dwelling
          } else {
            controls.enabled = true; // hand control back to the user (no snap)
            controls.update();
          }
        }
        return;
      }

      const dwell = dwellRef.current;
      if (dwell && autoTourRef.current) {
        const sel = selectedElRef.current;
        if (sel) {
          astScene(sel, days, flyAst);
          // Translate the camera with the body so it stays framed as it moves.
          camera.position.x += flyAst.x - dwell.last.x;
          camera.position.y += flyAst.y - dwell.last.y;
          camera.position.z += flyAst.z - dwell.last.z;
          controls.target.copy(flyAst);
          dwell.last.copy(flyAst);
        }
        controls.update();
        dwell.t += dt;
        if (dwell.t >= TOUR_DWELL) tourStep();
        return;
      }

      controls.update();
    };

    // Animation loop
    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3();
    const fovScale = 2 * Math.tan(((camera.fov / 2) * Math.PI) / 180);
    let raf = 0;
    let frame = 0;
    const animate = () => {
      const dt = clock.getDelta();
      if (playingRef.current) timeRef.current += speedRef.current * dt;
      const days = timeRef.current;

      // Move planets along their orbits.
      const earthPos = positionAt(EARTH_ELEMENTS, days);
      for (const { mesh, el } of planetsRef.current) {
        const [px, py, pz] = toScene(positionAt(el, days));
        mesh.position.set(px, py, pz);
      }

      // Propagate the asteroid cloud + count current close encounters.
      const elements = elementsRef.current;
      const positions = positionsRef.current;
      let encounters = 0;
      if (positions && elements.length) {
        for (let k = 0; k < elements.length; k++) {
          const p = positionAt(elements[k], days);
          positions[k * 3] = p.x;
          positions[k * 3 + 1] = p.z;
          positions[k * 3 + 2] = p.y;
          const dx = p.x - earthPos.x;
          const dy = p.y - earthPos.y;
          const dz = p.z - earthPos.z;
          if (dx * dx + dy * dy + dz * dz < ENCOUNTER_AU * ENCOUNTER_AU) encounters++;
        }
        const attr = pointsRef.current?.geometry.getAttribute("position") as
          | THREE.BufferAttribute
          | undefined;
        if (attr) attr.needsUpdate = true;
      }

      // Keep the selection marker glued to its body, spinning the rock, and
      // pulse the reticle.
      const sel = selectedElRef.current;
      if (sel) {
        const [mx, my, mz] = toScene(positionAt(sel, days));
        if (selMarkerRef.current) {
          selMarkerRef.current.position.set(mx, my, mz);
          selMarkerRef.current.rotation.y += dt * 0.5;
          selMarkerRef.current.rotation.x += dt * 0.22;
        }
        if (selReticleRef.current) {
          selReticleRef.current.position.set(mx, my, mz);
          const s = 0.46 + Math.sin(clock.elapsedTime * 3) * 0.06;
          selReticleRef.current.scale.set(s, s, 1);
        }
      }

      // Labels: constant on-screen size regardless of zoom.
      for (const { sprite, w, h } of labelsRef.current) {
        const d = camera.position.distanceTo(sprite.getWorldPosition(tmp));
        const hy = d * fovScale * 0.03;
        sprite.scale.set(hy * (w / h), hy, 1);
      }

      const pulse = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.05;
      sunGlowInner.scale.setScalar(1.4 * pulse);
      sunGlowOuter.scale.setScalar(2.6 * pulse);

      updateCamera(dt, days);
      if (composer) composer.render();
      else renderer.render(scene, camera);

      if (frame++ % 8 === 0) onReportRef.current(days, encounters);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("mousemove", onMove);
      renderer.domElement.removeEventListener("mouseleave", onLeave);
      controls.dispose();
      disposeSelection(selOrbitRef, selMarkerRef, selReticleRef);
      disposeAllOrbits(allOrbitsRef);
      reticleTexRef.current?.dispose();
      dotTexRef.current?.dispose();
      glowTex.dispose();
      labelsRef.current.forEach(({ sprite }) => {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      });
      labelsRef.current = [];
      planetsRef.current = [];
      disposePoints(pointsRef);
      bloomPass?.dispose();
      composer?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
    };
  }, []);

  // Rebuild the point cloud when the sample changes.
  useEffect(() => {
    elementsRef.current = props.orbits;
    if (sceneRef.current) {
      buildPoints(sceneRef.current, props.orbits, dotTexRef.current, pointsRef, positionsRef);
    }
  }, [props.orbits]);

  // (Re)build the selection orbit + marker when the selection or sample changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    disposeSelection(selOrbitRef, selMarkerRef, selReticleRef);
    const el = props.selectedId
      ? elementsRef.current.find((e) => e.id === props.selectedId) ?? null
      : null;
    selectedElRef.current = el;
    if (el) {
      buildSelection(scene, el, reticleTexRef.current, {
        orbit: selOrbitRef,
        marker: selMarkerRef,
        reticle: selReticleRef,
      });
    }
  }, [props.selectedId, props.orbits]);

  // Build / dispose the full-sample orbit web on toggle (and when the sample changes).
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    disposeAllOrbits(allOrbitsRef);
    if (props.showAllOrbits && elementsRef.current.length) {
      buildAllOrbits(scene, elementsRef.current, allOrbitsRef);
    }
  }, [props.showAllOrbits, props.orbits]);

  // Manual "Viajar": fly to the currently selected body when the nonce bumps.
  useEffect(() => {
    if (props.flyNonce <= 0) return;
    const el = selectedElRef.current;
    if (el) startFlyRef.current?.(el);
  }, [props.flyNonce]);

  // Auto-tour: start cycling through random bodies, or stop and restore control.
  useEffect(() => {
    autoTourRef.current = props.autoTour;
    if (props.autoTour) tourStepRef.current?.();
    else stopTourRef.current?.();
  }, [props.autoTour]);

  return <div ref={containerRef} className="h-full w-full" />;
}

// ───────────────────────────── Point cloud ─────────────────────────────

function buildPoints(
  scene: THREE.Scene,
  elements: OrbitalElements[],
  dotTex: THREE.Texture | null,
  pointsRef: React.RefObject<THREE.Points | null>,
  positionsRef: React.RefObject<Float32Array | null>,
) {
  disposePoints(pointsRef);

  const n = elements.length;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color();

  for (let k = 0; k < n; k++) {
    classRGB(elements[k], c);
    // Per-point brightness jitter → a livelier, more natural field.
    const b = 0.72 + Math.random() * 0.28;
    colors[k * 3] = c.r * b;
    colors[k * 3 + 1] = c.g * b;
    colors[k * 3 + 2] = c.b * b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  // Adaptive size: dense samples get fine grains, sparse ones chunkier dots.
  const size = Math.min(0.09, Math.max(0.02, 4.5 / Math.sqrt(Math.max(1, n))));

  const material = new THREE.PointsMaterial({
    size,
    map: dotTex ?? undefined,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    alphaTest: 0.25,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  pointsRef.current = points;
  positionsRef.current = positions;
}

function disposePoints(pointsRef: React.RefObject<THREE.Points | null>) {
  const prev = pointsRef.current;
  if (prev) {
    prev.geometry.dispose();
    (prev.material as THREE.Material).dispose();
    prev.removeFromParent();
    pointsRef.current = null;
  }
}

// ───────────────────────────── Orbit web ─────────────────────────────

function buildAllOrbits(
  scene: THREE.Scene,
  elements: OrbitalElements[],
  ref: React.RefObject<THREE.LineSegments | null>,
) {
  const n = elements.length;
  const seg = ALL_ORBIT_SEGMENTS;
  const positions = new Float32Array(n * seg * 2 * 3);
  const colors = new Float32Array(n * seg * 2 * 3);
  const c = new THREE.Color();
  const ring: [number, number, number][] = new Array(seg);

  let v = 0;
  for (let k = 0; k < n; k++) {
    classRGB(elements[k], c);
    for (let s = 0; s < seg; s++) {
      ring[s] = toScene(positionFromMeanAnomaly(elements[k], (s / seg) * 360));
    }
    for (let s = 0; s < seg; s++) {
      const a = ring[s];
      const b = ring[(s + 1) % seg];
      positions[v * 3] = a[0];
      positions[v * 3 + 1] = a[1];
      positions[v * 3 + 2] = a[2];
      colors[v * 3] = c.r;
      colors[v * 3 + 1] = c.g;
      colors[v * 3 + 2] = c.b;
      v++;
      positions[v * 3] = b[0];
      positions[v * 3 + 1] = b[1];
      positions[v * 3 + 2] = b[2];
      colors[v * 3] = c.r;
      colors[v * 3 + 1] = c.g;
      colors[v * 3 + 2] = c.b;
      v++;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  lines.frustumCulled = false;
  scene.add(lines);
  ref.current = lines;
}

function disposeAllOrbits(ref: React.RefObject<THREE.LineSegments | null>) {
  if (ref.current) {
    ref.current.geometry.dispose();
    (ref.current.material as THREE.Material).dispose();
    ref.current.removeFromParent();
    ref.current = null;
  }
}

// ───────────────────────────── Selection ─────────────────────────────

function buildSelection(
  scene: THREE.Scene,
  el: OrbitalElements,
  reticleTex: THREE.CanvasTexture | null,
  refs: {
    orbit: React.RefObject<THREE.LineLoop | null>;
    marker: React.RefObject<THREE.Mesh | null>;
    reticle: React.RefObject<THREE.Sprite | null>;
  },
) {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 180; k++) {
    pts.push(new THREE.Vector3(...toScene(positionFromMeanAnomaly(el, (k / 180) * 360))));
  }
  const orbit = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: SELECT_COLOR, transparent: true, opacity: 0.95 }),
  );
  scene.add(orbit);
  refs.orbit.current = orbit;

  const marker = new THREE.Mesh(
    makeAsteroidGeometry(0.1),
    new THREE.MeshStandardMaterial({
      color: 0xc7b9a3,
      emissive: 0x3a2f1e,
      emissiveIntensity: 0.45,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    }),
  );
  scene.add(marker);
  refs.marker.current = marker;

  if (reticleTex) {
    const reticle = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: reticleTex,
        transparent: true,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    reticle.scale.set(0.46, 0.46, 1);
    scene.add(reticle);
    refs.reticle.current = reticle;
  }
}

function disposeSelection(
  orbit: React.RefObject<THREE.LineLoop | null>,
  marker: React.RefObject<THREE.Mesh | null>,
  reticle: React.RefObject<THREE.Sprite | null>,
) {
  if (orbit.current) {
    orbit.current.geometry.dispose();
    (orbit.current.material as THREE.Material).dispose();
    orbit.current.removeFromParent();
    orbit.current = null;
  }
  if (marker.current) {
    marker.current.geometry.dispose();
    (marker.current.material as THREE.Material).dispose();
    marker.current.removeFromParent();
    marker.current = null;
  }
  if (reticle.current) {
    reticle.current.material.dispose(); // shared texture disposed on unmount
    reticle.current.removeFromParent();
    reticle.current = null;
  }
}

// ───────────────────────────── Canvas textures ─────────────────────────────

/**
 * An irregular, rocky billboard for the point cloud — a lumpy polygon silhouette
 * with center-lit shading and a couple of darker craters, so asteroids read as
 * rocks rather than perfect circles. The hard alpha edge is cut by `alphaTest`.
 */
function makeAsteroidTexture(): THREE.CanvasTexture {
  const s = 64;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const cx = s / 2;
  const cy = s / 2;
  const baseR = s * 0.4;

  // Irregular polygon outline.
  const steps = 13;
  ctx.beginPath();
  for (let k = 0; k <= steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    const r = baseR * (0.7 + Math.random() * 0.3);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  // Center-lit shading (multiplied by each point's colour). Kept bright so
  // dense fields stay luminous and coloured rather than turning to grey mud.
  const g = ctx.createRadialGradient(cx * 0.82, cy * 0.78, 1, cx, cy, baseR * 1.2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.65, "rgba(244,244,244,1)");
  g.addColorStop(1, "rgba(196,196,196,1)");
  ctx.fillStyle = g;
  ctx.fill();

  // A couple of subtle craters, clipped to the rock (visible only up close).
  ctx.globalCompositeOperation = "source-atop";
  for (let i = 0; i < 2; i++) {
    const rx = cx + (Math.random() - 0.5) * baseR;
    const ry = cy + (Math.random() - 0.5) * baseR;
    const rr = baseR * (0.12 + Math.random() * 0.12);
    const cg = ctx.createRadialGradient(rx, ry, 0, rx, ry, rr);
    cg.addColorStop(0, "rgba(150,150,150,0.4)");
    cg.addColorStop(1, "rgba(150,150,150,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

/**
 * A lumpy low-poly asteroid mesh (flat-shaded icosahedron with radially
 * displaced vertices). Displacement is hashed from the vertex position so shared
 * vertices stay watertight. Built fresh per selection → each rock looks unique.
 */
function makeAsteroidGeometry(radius: number): THREE.IcosahedronGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const h = Math.sin(v.x * 11.7 + v.y * 53.3 + v.z * 29.1) * 43758.5453;
    const f = 0.82 + (h - Math.floor(h)) * 0.42; // same direction ⇒ no cracks
    v.setLength(radius * f);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** A very soft halo used for the Sun's layered glow. */
function makeGlowTexture(): THREE.CanvasTexture {
  const s = 128;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.25, "rgba(255,240,200,0.55)");
  g.addColorStop(0.6, "rgba(255,200,120,0.18)");
  g.addColorStop(1, "rgba(255,180,90,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

/** A text label as a camera-facing sprite (no font file needed). */
function makeLabel(
  text: string,
  color: string,
): { sprite: THREE.Sprite; w: number; h: number } {
  const font = `600 44px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  const pad = 10;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const w = Math.ceil(measure.measureText(text).width) + pad * 2;
  const h = 44 + pad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  return { sprite, w, h };
}

/** A glowing ring reticle drawn around the selected body. */
function makeReticleTexture(): THREE.CanvasTexture {
  const s = 128;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = "rgba(253,224,71,0.95)";
  ctx.lineWidth = 6;
  ctx.shadowColor = "rgba(253,224,71,0.9)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 12, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}
