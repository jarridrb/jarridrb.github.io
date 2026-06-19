// Hero backdrop: a soft 3D Gaussian point cloud (a sphere of thousands of tiny
// monochrome dots, denser at the centre) that slowly rotates and shimmers —
// styled after the Human Frontier Collective hero. Sits on the right of the
// hero, behind the content. three.js is resolved via the layout import map.
import * as THREE from "three";

const canvas = document.getElementById("hero-canvas");
if (canvas) init();

function init() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 7;
  const cloud = new THREE.Group();
  cloud.position.set(1.6, 0, 0); // sit on the right, around/behind the photo
  scene.add(cloud);

  // ---- Build the Gaussian point cloud -----------------------------------
  const w = window.innerWidth;
  const N = w < 480 ? 2400 : w < 760 ? 3800 : 6200;
  const sigma = 1.0, maxR = 3.2;
  const base = new Float32Array(N * 3);
  const phase = new Float32Array(N);
  const colors = new Float32Array(N * 3);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    let x, y, z, r;
    do {
      x = randn() * sigma; y = randn() * sigma; z = randn() * sigma;
      r = Math.sqrt(x * x + y * y + z * z);
    } while (r > maxR);
    base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z;
    phase[i] = Math.random() * Math.PI * 2;
    // Warm dark grey dots, slight lightness variation (denser core reads darker).
    c.setHSL(0.09, 0.08, 0.18 + Math.random() * 0.24);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(base.slice(), 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.04, map: makeDotSprite(), vertexColors: true, transparent: true,
    opacity: 0.92, depthWrite: false, sizeAttenuation: true, blending: THREE.NormalBlending,
  });
  cloud.add(new THREE.Points(geo, mat));
  const pos = geo.attributes.position.array;

  const heroEl = canvas.closest(".hero") || canvas;

  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height || 1;
    camera.updateProjectionMatrix();
  }
  resize();
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 150); });

  function render(time) {
    // Gentle per-point shimmer so the cloud feels alive.
    for (let i = 0; i < N; i++) {
      const k = i * 3, ph = phase[i];
      pos[k] = base[k] + Math.sin(time * 0.0004 + ph) * 0.05;
      pos[k + 1] = base[k + 1] + Math.cos(time * 0.00045 + ph) * 0.05;
      pos[k + 2] = base[k + 2] + Math.sin(time * 0.0005 + ph * 1.3) * 0.05;
    }
    geo.attributes.position.needsUpdate = true;
    cloud.rotation.y = time * 0.00006;
    renderer.render(scene, camera);
  }

  if (reduceMotion) { render(0); return; }

  let running = true, raf = 0;
  const loop = (t) => { if (!running) return; render(t); raf = requestAnimationFrame(loop); };
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

// Standard-normal sample (Box-Muller).
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Soft round sprite so points read as dots, not squares.
function makeDotSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.4, "rgba(255,255,255,0.7)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
