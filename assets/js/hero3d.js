// Hero banner: a full-width strip filled with a dense field of solid, slowly
// rotating cartoon proteins (tube helices, flat beta-arrows, connecting coil)
// in teal, with occasional pink/orange ligand accents — styled after a
// biomolecular-design lab header. three.js is resolved via the layout import map.
import * as THREE from "three";

const canvas = document.getElementById("hero-canvas");
if (canvas) init();

function init() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Palette (bright teal proteins on a dark-teal band) ---------------
  const DEEP = new THREE.Color("#1f8b9b");
  const MID = new THREE.Color("#34b3c2");
  const LIGHT = new THREE.Color("#86e3ec");
  const PINK = new THREE.Color("#e85aa6");
  const ORANGE = new THREE.Color("#ef9d44");
  const tealRamp = (t) => {
    const c = new THREE.Color();
    return t < 0.5 ? c.copy(DEEP).lerp(MID, t / 0.5) : c.copy(MID).lerp(LIGHT, (t - 0.5) / 0.5);
  };

  // ---- Renderer / scene / camera / lights -------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  camera.position.z = 10;
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(2, 4, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfeff5, 0.4); fill.position.set(-4, -3, 2); scene.add(fill);
  const field = new THREE.Group();
  scene.add(field);

  // ---- Protein field ----------------------------------------------------
  let proteins = [];
  const disposables = [];

  function clearField() {
    for (const p of proteins) field.remove(p.group);
    for (const d of disposables) d.dispose();
    disposables.length = 0;
    proteins = [];
  }

  // One cartoon protein as a THREE.Group, with a little colour/accent variety.
  function makeProtein(idx) {
    const { segs, flat } = buildFold();
    const box = new THREE.Box3().setFromPoints(flat);
    const center = box.getCenter(new THREE.Vector3());
    const k = 2.7 / box.getSize(new THREE.Vector3()).length();
    const fix = (v) => v.sub(center).multiplyScalar(k);
    flat.forEach(fix);
    segs.forEach((s) => s.pts.forEach(fix));

    // Slight per-protein colour shift (some cooler/cyan, some deeper teal).
    const tint = (base) => base.clone().lerp(idx % 3 === 0 ? LIGHT : DEEP, 0.18);
    const g = new THREE.Group();
    const mat = (col, rough = 0.55) => {
      const m = new THREE.MeshStandardMaterial({
        color: tint(col), emissive: tint(col).clone().multiplyScalar(0.16),
        roughness: rough, metalness: 0.0, side: THREE.DoubleSide,
      });
      return m;
    };
    const addMesh = (geo, m) => { disposables.push(geo, m); g.add(new THREE.Mesh(geo, m)); };

    const curve = new THREE.CatmullRomCurve3(flat, false, "catmullrom", 0.5);
    addMesh(new THREE.TubeGeometry(curve, flat.length * 5, 0.05, 7, false), mat(MID));
    for (const s of segs) {
      if (s.type === "helix" && s.pts.length > 2) {
        addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(s.pts), s.pts.length * 5, 0.14, 9, false), mat(DEEP));
      } else if (s.type === "strand" && s.pts.length > 2) {
        addMesh(buildArrow(s.pts), mat(LIGHT, 0.5));
      }
    }
    // Accent ligand / residue on a subset for pops of pink + orange.
    if (idx % 3 === 1) {
      const lig = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 5),
        new THREE.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE.clone().multiplyScalar(0.2), roughness: 0.45 }));
      disposables.push(lig.geometry, lig.material);
      lig.position.set(-1.4, 1.3, 0.4); lig.rotation.set(0.5, 0.3, 0.2); g.add(lig);
    }
    if (idx % 4 === 2) {
      const res = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: PINK, emissive: PINK.clone().multiplyScalar(0.2), roughness: 0.5 }));
      disposables.push(res.geometry, res.material);
      res.position.set(0.4, 0, 0.5); res.rotation.z = -0.5; g.add(res);
    }
    return g;
  }

  // Scatter proteins across the wide band, varying depth / scale / rotation.
  function layoutField() {
    clearField();
    const r = canvas.getBoundingClientRect();
    const aspect = r.width / r.height || 6;
    const halfH = 2.0, halfW = halfH * aspect;
    camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();

    const spacing = 1.82;
    const count = Math.min(30, Math.ceil((halfW * 2) / spacing) + 2);
    for (let i = 0; i < count; i++) {
      const g = makeProtein(i);
      const jitter = (h) => (rand(i * 9.7 + h) - 0.5);
      const x = -halfW - spacing * 0.5 + i * spacing + jitter(1) * spacing * 0.5;
      const y = jitter(2) * (halfH * 0.85);
      g.position.set(x, y, jitter(3) * 4);
      const sc = 0.88 + rand(i * 3.1) * 0.52;
      g.scale.setScalar(sc);
      g.rotation.set(jitter(4) * 1.4, rand(i * 5.5) * Math.PI * 2, jitter(5) * 0.8);
      field.add(g);
      proteins.push({ group: g, sy: 0.0011 + rand(i * 2.3) * 0.0017, sx: (jitter(6)) * 0.0006 });
    }
  }

  function render() {
    field.rotation.y = px * 0.06;
    field.rotation.x = py * 0.04;
    renderer.render(scene, camera);
  }

  // ---- Pointer parallax -------------------------------------------------
  let px = 0, py = 0;
  const heroEl = canvas.closest(".hero") || canvas;
  heroEl.addEventListener("pointermove", (e) => {
    const r = heroEl.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width) * 2 - 1;
    py = ((e.clientY - r.top) / r.height) * 2 - 1;
  });

  // ---- Sizing -----------------------------------------------------------
  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(r.width, r.height, false);
  }
  resize();
  layoutField();
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { resize(); layoutField(); }, 160); });

  if (reduceMotion) { render(); return; }

  // ---- Animation loop (gentle per-protein rotation) ---------------------
  let running = true, raf = 0;
  const loop = () => {
    if (!running) return;
    for (const p of proteins) { p.group.rotation.y += p.sy; p.group.rotation.x += p.sx; }
    render();
    raf = requestAnimationFrame(loop);
  };
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

// Deterministic pseudo-random so the field is stable across resizes.
function rand(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// A flat beta-arrow: a ribbon along the strand that widens into an arrowhead
// and tapers to a point, lying in the sheet plane.
function buildArrow(pts) {
  const up = new THREE.Vector3(0, 1, 0);
  const tip = pts[pts.length - 1].clone().add(
    pts[pts.length - 1].clone().sub(pts[pts.length - 2]).normalize().multiplyScalar(0.5));
  const path = pts.concat([tip]);
  const m = path.length, body = 0.16, head = 0.32;
  const L = [], R = [], Nm = [];
  for (let i = 0; i < m; i++) {
    const prev = path[Math.max(0, i - 1)], next = path[Math.min(m - 1, i + 1)];
    const t = next.clone().sub(prev).normalize();
    let s = new THREE.Vector3().crossVectors(t, up);
    if (s.lengthSq() < 1e-4) s.set(1, 0, 0);
    s.normalize();
    const nrm = new THREE.Vector3().crossVectors(s, t).normalize();
    const hw = i >= m - 1 ? 0 : i >= m - 3 ? head : body;
    L.push(path[i].clone().addScaledVector(s, -hw));
    R.push(path[i].clone().addScaledVector(s, hw));
    Nm.push(nrm);
  }
  const positions = [], normals = [];
  const tri = (a, b, c, n) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let q = 0; q < 3; q++) normals.push(n.x, n.y, n.z);
  };
  for (let i = 0; i < m - 1; i++) { tri(L[i], R[i], R[i + 1], Nm[i]); tri(L[i], R[i + 1], L[i + 1], Nm[i]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return g;
}

// A compact, globular alpha/beta fold: a central twisted beta sheet flanked by
// alpha helices alternating above/below, joined into one continuous chain.
function buildFold() {
  const segs = [], flat = [];
  const add = (type, pts) => { if (pts.length) { segs.push({ type, pts }); for (const p of pts) flat.push(p); } };
  const nStrand = 5, strandLen = 7, step = 0.40, zGap = 1.05;
  let dirRight = true, helixSide = 1;
  for (let s = 0; s < nStrand; s++) {
    const z = (s - (nStrand - 1) / 2) * zGap;
    const xStart = dirRight ? -1.4 : 1.4, xDir = dirRight ? 1 : -1;
    const strand = [];
    for (let i = 0; i < strandLen; i++) {
      const x = xStart + xDir * i * step;
      strand.push(new THREE.Vector3(x, x * 0.16 + (i % 2 ? 0.07 : -0.07), z + (Math.random() - 0.5) * 0.06));
    }
    add("strand", strand);
    if (s < nStrand - 1) {
      const endX = xStart + xDir * (strandLen - 1) * step;
      const hy = helixSide * 1.6;
      add("loop", [
        new THREE.Vector3(endX + xDir * 0.28, hy * 0.45, z + 0.22),
        new THREE.Vector3(endX + xDir * 0.10, hy * 0.85, z + 0.46),
      ]);
      const haxis = new THREE.Vector3(-xDir, 0.10 * helixSide, 0.05).normalize();
      const helix = addHelix(new THREE.Vector3(endX, hy, z + 0.6), haxis, 10, s % 2 ? 1 : -1);
      add("helix", helix);
      const hEnd = helix[helix.length - 1];
      const nz = ((s + 1) - (nStrand - 1) / 2) * zGap;
      const nxStart = !dirRight ? -1.4 : 1.4;
      add("loop", [
        new THREE.Vector3(hEnd.x * 0.6, hy * 0.4, (z + nz) / 2),
        new THREE.Vector3(nxStart - xDir * 0.3, 0.15, nz - 0.28),
      ]);
      helixSide *= -1;
    }
    dirRight = !dirRight;
  }
  return { segs, flat };
}

function addHelix(start, axis, n, hand) {
  axis = axis.clone().normalize();
  const ref = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(axis, ref).normalize();
  const up = new THREE.Vector3().crossVectors(side, axis).normalize();
  const radius = 0.46, rise = 0.32, turn = 1.74 * hand;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i * turn;
    const radial = side.clone().multiplyScalar(Math.cos(a) * radius).add(up.clone().multiplyScalar(Math.sin(a) * radius));
    pts.push(start.clone().add(axis.clone().multiplyScalar(i * rise)).add(radial));
  }
  return pts;
}
