/* =============================================================
   Hero 3D — procedural "CR-01" circuit board (Three.js)
   Purely decorative (canvas is aria-hidden). Skipped entirely
   under reduced motion / reduced data. Mouse drag-to-rotate only
   (touch never captured, so page scroll is never trapped).
   ============================================================= */
import * as THREE from "three";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const reduceData = window.matchMedia("(prefers-reduced-data: reduce)").matches;
const canvas = document.getElementById("board-canvas");

if (canvas && !reduceMotion && !reduceData) {
  try { boot(); } catch (e) { /* decorative — fail silently */ }
}

function boot() {
  const stage = canvas.parentElement;
  let W = stage.clientWidth || window.innerWidth;
  let H = stage.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
  camera.position.set(0, 0, 9);

  /* ---------- lighting ---------- */
  scene.add(new THREE.AmbientLight(0x6a7785, 0.65));
  const key = new THREE.DirectionalLight(0xdfe6ee, 1.15); key.position.set(4, 6, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0x3a4656, 0.55); fill.position.set(-5, 2, -3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x8fb0d6, 0.6); rim.position.set(0, -4, -6); scene.add(rim);
  const glow = new THREE.PointLight(0x5e86b3, 0.5, 30); glow.position.set(-1, -1, 3); scene.add(glow);

  /* ---------- materials ---------- */
  const matBoard  = new THREE.MeshStandardMaterial({ color: 0x121821, roughness: 0.6, metalness: 0.25 });
  const matEdge   = new THREE.MeshStandardMaterial({ color: 0x0c1118, roughness: 0.7, metalness: 0.2 });
  const matTrace  = new THREE.MeshStandardMaterial({ color: 0x223043, roughness: 0.4, metalness: 0.6, emissive: 0x5e86b3, emissiveIntensity: 0.35 });
  const matGold   = new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.35, metalness: 0.9 });
  const matChip   = new THREE.MeshStandardMaterial({ color: 0x0c1117, roughness: 0.5, metalness: 0.4 });
  const matPin    = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.4, metalness: 0.8 });
  const matCap    = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.5, metalness: 0.5 });
  const matLed    = new THREE.MeshStandardMaterial({ color: 0x7ba3ce, emissive: 0x7ba3ce, emissiveIntensity: 1.4, roughness: 0.3 });

  const board = new THREE.Group();
  scene.add(board);

  /* ---------- substrate (rounded extruded rectangle) ---------- */
  const BW = 4.6, BH = 3.0, BT = 0.18, R = 0.18;
  const shape = new THREE.Shape();
  shape.moveTo(-BW / 2 + R, -BH / 2);
  shape.lineTo(BW / 2 - R, -BH / 2);
  shape.quadraticCurveTo(BW / 2, -BH / 2, BW / 2, -BH / 2 + R);
  shape.lineTo(BW / 2, BH / 2 - R);
  shape.quadraticCurveTo(BW / 2, BH / 2, BW / 2 - R, BH / 2);
  shape.lineTo(-BW / 2 + R, BH / 2);
  shape.quadraticCurveTo(-BW / 2, BH / 2, -BW / 2, BH / 2 - R);
  shape.lineTo(-BW / 2, -BH / 2 + R);
  shape.quadraticCurveTo(-BW / 2, -BH / 2, -BW / 2 + R, -BH / 2);
  const boardGeo = new THREE.ExtrudeGeometry(shape, { depth: BT, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  boardGeo.center();
  const substrate = new THREE.Mesh(boardGeo, [matBoard, matEdge]);
  board.add(substrate);

  const TOP = BT / 2 + 0.012;

  /* ---------- copper traces (tubes) + stored curves for pulses ---------- */
  const pulseCurves = [];
  function trace(points, store) {
    const v = points.map((p) => new THREE.Vector3(p[0], p[1], TOP));
    const curve = new THREE.CatmullRomCurve3(v, false, "catmullrom", 0.0);
    const geo = new THREE.TubeGeometry(curve, Math.max(8, v.length * 6), 0.018, 6, false);
    board.add(new THREE.Mesh(geo, matTrace));
    if (store) pulseCurves.push(curve);
  }
  // hand-routed elbow traces fanning out from the centre chip
  trace([[-0.2, 0.3], [-1.3, 0.3], [-1.3, 1.05], [-1.95, 1.05]], true);
  trace([[0.2, 0.35], [1.25, 0.35], [1.25, 1.0], [1.95, 1.0]], true);
  trace([[-0.25, -0.3], [-1.4, -0.3], [-1.4, -1.05], [-1.9, -1.05]], true);
  trace([[0.25, -0.32], [1.4, -0.32], [1.4, -1.0], [1.95, -1.0]], true);
  trace([[0.35, 0.1], [1.7, 0.1], [1.7, 0.45]], true);
  trace([[-0.35, -0.05], [-1.75, -0.05], [-1.75, -0.5]], true);
  trace([[-0.1, 0.4], [-0.1, 1.15], [0.55, 1.15]], false);
  trace([[0.1, -0.4], [0.1, -1.15], [-0.6, -1.15]], false);
  trace([[0.4, -0.1], [0.95, -0.1], [0.95, -0.7], [1.5, -0.7]], false);
  trace([[-0.4, 0.15], [-0.95, 0.15], [-0.95, 0.7], [-1.5, 0.7]], false);

  /* ---------- vias / pads ---------- */
  const viaGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14);
  const viaSpots = [[-1.95, 1.05], [1.95, 1.0], [-1.9, -1.05], [1.95, -1.0], [1.7, 0.45], [-1.75, -0.5], [0.55, 1.15], [-0.6, -1.15], [1.5, -0.7], [-1.5, 0.7]];
  viaSpots.forEach((s) => {
    const m = new THREE.Mesh(viaGeo, matGold);
    m.rotation.x = Math.PI / 2; m.position.set(s[0], s[1], TOP);
    board.add(m);
  });

  /* ---------- components ---------- */
  // main IC + silkscreen label
  const ic = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.16), matChip);
  ic.position.set(0, 0, BT / 2 + 0.08); board.add(ic);
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < 7; i++) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.05), matPin);
      const off = -0.45 + i * 0.15;
      if (s === 0) pin.position.set(off, 0.56, BT / 2 + 0.05);
      if (s === 1) pin.position.set(off, -0.56, BT / 2 + 0.05);
      if (s === 2) { pin.position.set(0.56, off, BT / 2 + 0.05); pin.rotation.z = Math.PI / 2; }
      if (s === 3) { pin.position.set(-0.56, off, BT / 2 + 0.05); pin.rotation.z = Math.PI / 2; }
      board.add(pin);
    }
  }
  board.add(makeLabel("CR·01", 0, 0, BT / 2 + 0.162, 0.85));

  // secondary chips
  [[-1.5, 1.05, 0.6, 0.42], [1.55, -1.05, 0.55, 0.4]].forEach((c) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(c[2], c[3], 0.12), matChip);
    m.position.set(c[0], c[1], BT / 2 + 0.06); board.add(m);
  });

  // capacitors (cylinders)
  [[1.0, 0.95], [-1.0, -0.95], [1.85, 0.0], [-1.85, 0.2]].forEach((c) => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 18), matCap);
    cap.rotation.x = Math.PI / 2; cap.position.set(c[0], c[1], BT / 2 + 0.17); board.add(cap);
  });

  // header pins (gold row)
  for (let i = 0; i < 6; i++) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.22), matGold);
    h.position.set(-2.0 + i * 0.16, -1.3, BT / 2 + 0.1); board.add(h);
  }

  // LEDs (subtle emissive)
  [[1.95, 1.28], [1.78, 1.28]].forEach((c) => {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), matLed);
    led.position.set(c[0], c[1], BT / 2 + 0.05); board.add(led);
  });

  // small SMD resistors
  for (let i = 0; i < 8; i++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.05), matChip);
    r.position.set(-2.0 + Math.random() * 4, -0.2 + Math.random() * 0.4 + (i % 2 ? 1.6 : -1.6) * 0.4, BT / 2 + 0.04);
    board.add(r);
  }

  /* ---------- travelling signal pulses ---------- */
  const pulseGeo = new THREE.SphereGeometry(0.045, 10, 10);
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0xcfe2f5, transparent: true, blending: THREE.AdditiveBlending });
  const pulses = pulseCurves.map((curve, i) => {
    const mesh = new THREE.Mesh(pulseGeo, pulseMat);
    board.add(mesh);
    return { mesh, curve, t: Math.random(), speed: 0.18 + Math.random() * 0.12 };
  });

  /* ---------- silkscreen label helper ---------- */
  function makeLabel(text, x, y, z, size) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#cfd8e2"; ctx.font = "700 60px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 120);
    ctx.strokeStyle = "rgba(180,200,220,.5)"; ctx.lineWidth = 3;
    ctx.strokeRect(40, 60, 176, 120);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    mesh.position.set(x, y, z);
    return mesh;
  }

  /* ---------- orientation + interaction ---------- */
  const baseX = -0.42, baseY = -0.5;
  board.position.x = W > 760 ? 1.7 : 0;
  board.rotation.x = baseX;
  board.rotation.y = baseY;
  renderer.render(scene, camera); // one static frame immediately (visible even if RAF is throttled)
  let spin = 0, pointerX = 0, pointerY = 0, dragX = 0, dragY = 0;
  let dragging = false, lastX = 0, lastY = 0;

  window.addEventListener("mousemove", (e) => {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // drag-to-rotate: MOUSE ONLY — touch is never captured, so the page scrolls
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.style.cursor = "grabbing";
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dragY += (e.clientX - lastX) * 0.006;
    dragX += (e.clientY - lastY) * 0.006;
    dragX = Math.max(-0.8, Math.min(0.8, dragX));
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener("pointerup", () => { dragging = false; canvas.style.cursor = ""; });
  canvas.style.cursor = "grab";

  /* ---------- loop with pause-when-offscreen ---------- */
  const clock = new THREE.Clock();
  let frameId = null, inView = true;

  function frame() {
    frameId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!dragging) spin += dt * 0.16;
    board.rotation.y += ((baseY + spin + pointerX * 0.28 + dragY) - board.rotation.y) * 0.06;
    board.rotation.x += ((baseX + pointerY * 0.16 + dragX) - board.rotation.x) * 0.06;
    glow.position.x = Math.sin(spin * 0.7) * 2;
    pulses.forEach((p) => {
      p.t += dt * p.speed; if (p.t > 1) p.t -= 1;
      p.curve.getPointAt(p.t, p.mesh.position);
    });
    renderer.render(scene, camera);
  }
  function play() { if (frameId == null && inView && !document.hidden) frame(); }
  function pause() { if (frameId != null) { cancelAnimationFrame(frameId); frameId = null; } }

  new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    inView ? play() : pause();
  }, { threshold: 0.01 }).observe(canvas);
  document.addEventListener("visibilitychange", () => { document.hidden ? pause() : play(); });

  /* ---------- resize ---------- */
  let rid;
  window.addEventListener("resize", () => {
    clearTimeout(rid);
    rid = setTimeout(() => {
      W = stage.clientWidth; H = stage.clientHeight;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      renderer.setSize(W, H, false);
      board.position.x = W > 760 ? 1.7 : 0;
      renderer.render(scene, camera);
    }, 200);
  });

  /* ---------- teardown if user switches to reduced motion ---------- */
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(() => {
    if (mq.matches) { pause(); renderer.dispose(); canvas.style.display = "none"; }
  });
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); pause(); });

  play();
}
