// Signature hero: a denoising "diffusion" particle field that condenses into a
// procedural protein backbone, synchronized with an amino-acid sequence strip
// that resolves from noise — a nod to sequence-structure co-design.
//
// Loaded as an ES module; `three` is resolved via the import map in the layout.
import * as THREE from "three";

const canvas = document.getElementById("hero-canvas");
const seqEl = document.getElementById("seq-strip");
if (canvas) init();

function init() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Palette (matches the warm site theme) ----------------------------
  const GOLD = new THREE.Color("#f6c970");
  const AMBER = new THREE.Color("#ea9d52");
  const RED = new THREE.Color("#d9604a");
  // Sample the gold->amber->red ramp at t in [0,1].
  const warm = (t) => {
    const c = new THREE.Color();
    if (t < 0.5) c.copy(GOLD).lerp(AMBER, t / 0.5);
    else c.copy(AMBER).lerp(RED, (t - 0.5) / 0.5);
    return c;
  };

  // ---- Renderer / scene / camera ----------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);
  const group = new THREE.Group();
  group.position.set(0.15, -0.05, 0);
  scene.add(group);

  // ---- Procedural protein backbone (alpha helices joined by loops) ------
  const ctrlPoints = buildBackbone();
  // Center + scale to a consistent size.
  const box = new THREE.Box3().setFromPoints(ctrlPoints);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const scale = 4.6 / size;
  ctrlPoints.forEach((p) => p.sub(center).multiplyScalar(scale));
  const curve = new THREE.CatmullRomCurve3(ctrlPoints, false, "catmullrom", 0.5);

  // ---- Backbone "ribbon" (a thin glowing tube along the chain) ----------
  const TUB = 260, RAD = 8;
  const tubeGeo = new THREE.TubeGeometry(curve, TUB, 0.05, RAD, false);
  const tubeColors = new Float32Array(tubeGeo.attributes.position.count * 3);
  let ci = 0;
  for (let i = 0; i <= TUB; i++) {
    const c = warm(i / TUB);
    for (let j = 0; j <= RAD; j++) { tubeColors[ci++] = c.r; tubeColors[ci++] = c.g; tubeColors[ci++] = c.b; }
  }
  tubeGeo.setAttribute("color", new THREE.Float32BufferAttribute(tubeColors, 3));
  const tubeMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  group.add(tube);

  // ---- Diffusing particle cloud -----------------------------------------
  const w = window.innerWidth;
  const N = w < 480 ? 420 : w < 760 ? 620 : 1150;
  const along = curve.getSpacedPoints(N);
  const targets = new Float32Array(N * 3);   // condensed (structure) positions
  const noises = new Float32Array(N * 3);    // diffuse (noise) positions
  const seeds = new Float32Array(N);
  const pcol = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const base = along[i % along.length];
    const off = randInSphere(0.14);
    targets[i * 3] = base.x + off.x; targets[i * 3 + 1] = base.y + off.y; targets[i * 3 + 2] = base.z + off.z;
    const ns = randInSphere(3.6);
    noises[i * 3] = ns.x * 1.25; noises[i * 3 + 1] = ns.y; noises[i * 3 + 2] = ns.z * 1.25;
    seeds[i] = Math.random() * Math.PI * 2;
    const c = warm(i / N);
    pcol[i * 3] = c.r; pcol[i * 3 + 1] = c.g; pcol[i * 3 + 2] = c.b;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  pgeo.setAttribute("color", new THREE.Float32BufferAttribute(pcol, 3));
  const pmat = new THREE.PointsMaterial({
    size: 0.085, map: makeDotSprite(), vertexColors: true, transparent: true,
    opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(pgeo, pmat);
  group.add(points);
  const pos = pgeo.attributes.position.array;

  // ---- Sequence strip ----------------------------------------------------
  const AA = "ACDEFGHIKLMNPQRSTVWY";
  let seqLen = 0, target = [], resVer = [];
  function buildSeq() {
    if (!seqEl) return;
    seqLen = Math.max(24, Math.min(64, Math.floor(window.innerWidth / 15)));
    target = []; resVer = []; seqEl.innerHTML = "";
    for (let i = 0; i < seqLen; i++) {
      target.push(AA[(Math.random() * AA.length) | 0]);
      const s = document.createElement("span");
      s.className = "res";
      s.textContent = AA[(Math.random() * AA.length) | 0];
      seqEl.appendChild(s);
      resVer.push(false);
    }
  }
  buildSeq();
  let lastSeq = 0;
  function updateSeq(d, t) {
    if (!seqEl || t - lastSeq < 70) return; // throttle scramble ~14fps
    lastSeq = t;
    const revealed = Math.floor(d * seqLen);
    const spans = seqEl.children;
    for (let i = 0; i < seqLen; i++) {
      const on = i < revealed;
      const span = spans[i];
      if (on) {
        if (!resVer[i]) { span.textContent = target[i]; span.classList.add("on"); resVer[i] = true; }
      } else {
        resVer[i] = false;
        span.classList.remove("on");
        span.textContent = AA[(Math.random() * AA.length) | 0];
      }
    }
  }

  // ---- Pointer parallax + drag rotation ---------------------------------
  let px = 0, py = 0, baseRY = 0, dragging = false, lastX = 0;
  const heroEl = canvas.closest(".hero") || canvas;
  heroEl.addEventListener("pointermove", (e) => {
    const r = heroEl.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width) * 2 - 1;
    py = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (dragging) { baseRY += (e.clientX - lastX) * 0.006; lastX = e.clientX; }
  });
  heroEl.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; });
  window.addEventListener("pointerup", () => { dragging = false; });

  // ---- Sizing ------------------------------------------------------------
  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { resize(); buildSeq(); }, 150); });

  // ---- Diffusion schedule: cloud -> structure -> hold -> dissolve -------
  const smooth = (x) => x * x * (3 - 2 * x);
  function schedule(time) {
    const P = 11000, e = (time % P) / P;
    if (e < 0.42) return smooth(e / 0.42);            // denoise in
    if (e < 0.68) return 1;                            // hold formed
    return 1 - smooth((e - 0.68) / 0.32);              // re-noise out
  }

  function frame(d, time) {
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      const jitter = (1 - d) * 0.05;
      const s = seeds[i];
      pos[k] = noises[k] * (1 - d) + targets[k] * d + Math.sin(time * 0.0012 + s) * jitter;
      pos[k + 1] = noises[k + 1] * (1 - d) + targets[k + 1] * d + Math.cos(time * 0.0013 + s) * jitter;
      pos[k + 2] = noises[k + 2] * (1 - d) + targets[k + 2] * d + Math.sin(time * 0.0011 + s * 1.3) * jitter;
    }
    pgeo.attributes.position.needsUpdate = true;
    tubeMat.opacity = Math.max(0, (d - 0.35) / 0.65) * 0.75;
    baseRY += 0.0016;
    group.rotation.y = baseRY + px * 0.45;
    group.rotation.x = -0.08 + py * 0.22;
    renderer.render(scene, camera);
    updateSeq(d, time);
  }

  // ---- Reduced motion: render a single formed frame, no loop ------------
  if (reduceMotion) { frame(1, 0); return; }

  // ---- Animation loop (paused when offscreen / tab hidden) --------------
  let running = true, raf = 0;
  const loop = (t) => { if (!running) return; frame(schedule(t), t); raf = requestAnimationFrame(loop); };
  const start = () => { if (!running) { running = true; raf = requestAnimationFrame(loop); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => es.forEach((en) => (en.isIntersecting ? start() : stop())), { threshold: 0.02 })
      .observe(heroEl);
  }
  raf = requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// A soft round sprite so particles read as glowing dots, not squares.
function makeDotSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Uniformly-distributed point inside a sphere of the given radius.
function randInSphere(r) {
  const u = Math.random(), v = Math.random();
  const theta = u * Math.PI * 2, phi = Math.acos(2 * v - 1);
  const rad = r * Math.cbrt(Math.random());
  return new THREE.Vector3(
    rad * Math.sin(phi) * Math.cos(theta),
    rad * Math.sin(phi) * Math.sin(theta),
    rad * Math.cos(phi),
  );
}

// Build a protein-like Cα trace: several alpha helices joined by short loops,
// each helix pointed in a slightly rotated direction so the chain folds.
function buildBackbone() {
  const pts = [];
  let p = new THREE.Vector3(-2.4, -1.6, -0.4);
  let axis = new THREE.Vector3(1, 0.5, 0.2).normalize();
  const helices = [16, 13, 19, 11, 15, 9];
  for (let h = 0; h < helices.length; h++) {
    p = addHelix(pts, p, axis, helices[h], h % 2 ? -1 : 1);
    // Loop: drift a few residues while turning to a new axis.
    const turn = new THREE.Euler((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.2);
    axis = axis.clone().applyEuler(turn).normalize();
    for (let i = 0; i < 4; i++) { p = p.clone().add(axis.clone().multiplyScalar(0.42)); pts.push(p.clone()); }
  }
  return pts;
}

function addHelix(pts, start, axis, n, hand) {
  axis = axis.clone().normalize();
  const ref = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(axis, ref).normalize();
  const up = new THREE.Vector3().crossVectors(side, axis).normalize();
  const radius = 0.5, rise = 0.36, turn = 1.74 * hand; // ~100 deg/residue
  let end = start.clone();
  for (let i = 0; i < n; i++) {
    const a = i * turn;
    const radial = side.clone().multiplyScalar(Math.cos(a) * radius).add(up.clone().multiplyScalar(Math.sin(a) * radius));
    const c = start.clone().add(axis.clone().multiplyScalar(i * rise));
    pts.push(c.add(radial));
    end = start.clone().add(axis.clone().multiplyScalar(i * rise));
  }
  return end;
}
