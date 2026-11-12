/* =============================================================
   Cameron Roberts — 3D wireframe cinematic intro (first load only)
   - Gated by window.PLAY_INTRO (set by the inline head script):
     skipped on prefers-reduced-motion, mobile, repeat session visits,
     and when WebGL is unavailable. Nothing below loads when skipped.
   - Plays a ~9s continuous camera flight through wireframe models of
     his Saturn V, F-16 and RB9, then reveals the site.
   - Skip button + Escape end it immediately; site stays inert underneath.
   ============================================================= */
(async function () {
  "use strict";
  if (!window.PLAY_INTRO) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; // live re-check

  const main = document.getElementById("main");
  const siteLoader = document.getElementById("loader");

  /* ---------- overlay (container carries no role/label; it is decorative) ---------- */
  const overlay = document.createElement("div");
  overlay.id = "intro3d";
  overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:#08080b;opacity:1;transition:opacity .5s ease";
  const style = document.createElement("style");
  style.textContent = ".intro3d__skip:focus-visible{outline:2px solid #ECE6D8;outline-offset:3px}";
  overlay.appendChild(style);
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "intro3d__skip";
  skip.textContent = "Skip intro";
  skip.style.cssText = "position:fixed;right:18px;bottom:16px;z-index:10000;font:600 12px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#ECE6D8;background:#0b0b0e;border:1px solid rgba(236,230,216,.5);border-radius:999px;padding:9px 16px;cursor:pointer";
  const note = document.createElement("div");
  note.setAttribute("aria-hidden", "true");
  note.style.cssText = "position:fixed;left:18px;bottom:18px;z-index:10000;font:11px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#6f6a60";
  note.textContent = "Loading";
  overlay.appendChild(skip);
  overlay.appendChild(note);
  document.body.appendChild(overlay);

  /* lock the site behind the overlay: inert every non-overlay body child */
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  const inerted = [];
  Array.prototype.forEach.call(document.body.children, el => { if (el !== overlay && !el.hasAttribute("inert")) { el.setAttribute("inert", ""); inerted.push(el); } });
  if (siteLoader && siteLoader.parentNode) siteLoader.parentNode.removeChild(siteLoader);
  const lastFocus = document.activeElement;
  skip.focus();

  let ended = false, raf = 0, renderer = null, composer = null;
  function onKey(e) { if (e.key === "Escape") end(); }
  function end() {
    if (ended) return; ended = true;
    removeEventListener("keydown", onKey);
    removeEventListener("resize", resize);
    try { if (tl) tl.kill(); } catch (e) {}
    cancelAnimationFrame(raf);
    overlay.style.opacity = "0";
    setTimeout(function () {
      try { dispose(); } catch (e) {}
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.body.style.overflow = prevOverflow;
      inerted.forEach(el => el.removeAttribute("inert"));
      const target = document.getElementById("mh-h1") || main;
      if (target) { target.setAttribute("tabindex", "-1"); try { target.focus({ preventScroll: true }); } catch (e) {} }
      else if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    }, 520);
  }
  skip.addEventListener("click", end);
  addEventListener("keydown", onKey);

  /* ---------- load libraries (only now, when actually playing) ---------- */
  let THREE, GLTFLoader, EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, gsap;
  try {
    THREE = await import("three");
    GLTFLoader = (await import("three/addons/loaders/GLTFLoader.js")).GLTFLoader;
    EffectComposer = (await import("three/addons/postprocessing/EffectComposer.js")).EffectComposer;
    RenderPass = (await import("three/addons/postprocessing/RenderPass.js")).RenderPass;
    UnrealBloomPass = (await import("three/addons/postprocessing/UnrealBloomPass.js")).UnrealBloomPass;
    ShaderPass = (await import("three/addons/postprocessing/ShaderPass.js")).ShaderPass;
    gsap = (await import("gsap")).default;
  } catch (e) { end(); return; }
  if (ended) return;

  let W = innerWidth, H = innerHeight;
  renderer = new THREE.WebGLRenderer({ antialias: true, precision: "highp", stencil: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 820 ? 1.5 : 2)); // lighter on phones
  renderer.setSize(W, H, false); renderer.setClearColor(0x08080b, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;z-index:1";
  renderer.domElement.setAttribute("aria-hidden", "true");
  overlay.insertBefore(renderer.domElement, skip);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, W / H, 0.1, 200);
  const dolly = new THREE.Group(); scene.add(camera);
  const look = new THREE.Vector3();

  function revealMat() {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uReveal: { value: 0 }, uColor: { value: new THREE.Color(0xECE6D8) }, uOpacity: { value: 0.9 } },
      vertexShader: "attribute float aOrder; varying float vO; void main(){ vO=aOrder; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
      fragmentShader: "uniform float uReveal,uOpacity; uniform vec3 uColor; varying float vO; void main(){ if(vO>uReveal) discard; float edge=smoothstep(uReveal,uReveal-0.06,vO); gl_FragColor=vec4(uColor*(1.0+edge*0.8),uOpacity);} "
    });
  }
  function addOrder(geo, axis, bmin, bspan) {
    const pos = geo.attributes.position, n = pos.count, arr = new Float32Array(n);
    for (let i = 0; i < n; i++) { const val = pos.array[i * 3 + axis]; arr[i] = Math.min(1, Math.max(0, (val - bmin) / bspan)) * 0.85 + Math.random() * 0.15; }
    geo.setAttribute("aOrder", new THREE.BufferAttribute(arr, 1));
  }
  const base = "assets/models/";
  const CFG = {
    rocket: { file: base + "saturnv.glb", thr: 16, fit: 9, axis: 1, rot: [0, 0, 0], pos: [0, 0, 0] },
    jet: { file: base + "f16.glb", thr: 18, fit: 9, axis: 0, rot: [0.05, 0.7, 0.12], pos: [14, 26, -34] },
    car: { file: base + "rb9.glb", thr: 22, fit: 8, axis: 2, rot: [0, -0.15, 0], pos: [30, -14, -74] }
  };
  const gltf = new GLTFLoader();
  const vehicles = {};
  function buildVehicle(key) {
    return new Promise((res, rej) => {
      const cfg = CFG[key];
      gltf.load(cfg.file, g => {
        const model = g.scene; model.updateWorldMatrix(true, true);
        const grp = new THREE.Group(); const mat = revealMat();
        model.traverse(o => { if (!o.isMesh || !o.geometry) return; let eg; try { eg = new THREE.EdgesGeometry(o.geometry, cfg.thr); } catch (e) { return; } eg.applyMatrix4(o.matrixWorld); const ls = new THREE.LineSegments(eg, mat); ls.frustumCulled = false; grp.add(ls); });
        const box = new THREE.Box3().setFromObject(grp); const c = new THREE.Vector3(); box.getCenter(c);
        const size = new THREE.Vector3(); box.getSize(size); const s = cfg.fit / Math.max(size.x, size.y, size.z);
        grp.children.forEach(ls => ls.geometry.translate(-c.x, -c.y, -c.z));
        const b2 = new THREE.Box3(); grp.children.forEach(ls => { ls.geometry.computeBoundingBox(); b2.union(ls.geometry.boundingBox); });
        const bmin = b2.min.getComponent(cfg.axis), bspan = Math.max(0.001, b2.max.getComponent(cfg.axis) - bmin);
        grp.children.forEach(ls => addOrder(ls.geometry, cfg.axis, bmin, bspan));
        grp.scale.setScalar(s); grp.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
        grp.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
        scene.add(grp); vehicles[key] = { grp, mat, size: size.clone(), s }; res();
      }, undefined, e => rej(e));
    });
  }

  /* ---- wireframe smoke (world-space puffs as 2D bezier clouds) ---- */
  const smokeCanvas = document.createElement("canvas"); smokeCanvas.width = W; smokeCanvas.height = H;
  smokeCanvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2";
  smokeCanvas.setAttribute("aria-hidden", "true");
  overlay.insertBefore(smokeCanvas, skip);
  const sctx = smokeCanvas.getContext("2d");
  const EMIT = new THREE.Vector3(0, -3.8, 0);
  const FOVT = Math.tan(camera.fov * Math.PI / 360);
  const SMOKE_N = 150, puffs = []; for (let i = 0; i < SMOKE_N; i++) puffs.push({ live: false }); let spPtr = 0;
  function emitPuff() { const p = puffs[spPtr]; spPtr = (spPtr + 1) % SMOKE_N; p.live = true; p.born = simTime; p.ttl = 2.6 + Math.random() * 1.8; p.x = EMIT.x + (Math.random() - .5) * 1.8; p.y = EMIT.y + (Math.random() - .5) * 0.8; p.z = EMIT.z + (Math.random() - .5) * 1.8; const a = Math.random() * 6.283, sp = 2.4 + Math.random() * 3.2; p.vx = Math.cos(a) * sp; p.vy = -(3.8 + Math.random() * 3.5); p.vz = Math.sin(a) * sp; p.r0 = 0.8; p.r1 = 3.4 + Math.random() * 1.6; p.seed = Math.floor(Math.random() * 1e5); p.rot = (Math.random() - .5) * 0.5; }
  function updateSmoke(dt) { for (const p of puffs) { if (!p.live) continue; const age = simTime - p.born; if (age >= p.ttl) { p.live = false; continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= (1 - 0.35 * dt); p.vz *= (1 - 0.35 * dt); p.vy += 6.5 * dt; } }
  function ss(x, a, b) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
  const _pv = new THREE.Vector3();
  function drawCloud(ctx, x, y, R, seed, age, op) { ctx.save(); ctx.translate(x, y); ctx.globalAlpha = op; let s = seed; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; const lobes = 8, pts = []; for (let i = 0; i < lobes; i++) { const a = i / lobes * 6.283; const rr = R * (0.72 + rnd() * 0.32 + 0.07 * Math.sin(a * 3 + age)); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.88]); } ctx.beginPath(); for (let i = 0; i < lobes; i++) { const p0 = pts[i], p1 = pts[(i + 1) % lobes]; const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2; const len = Math.hypot(mx, my) || 1; const bulge = R * 0.42; const cx = mx + mx / len * bulge, cy = my + my / len * bulge; if (i === 0) ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(cx, cy, p1[0], p1[1]); } ctx.closePath(); ctx.strokeStyle = "#ECE6D8"; ctx.lineWidth = 1.4; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.shadowColor = "rgba(236,230,216,0.65)"; ctx.shadowBlur = 7; ctx.stroke(); ctx.restore(); }
  function drawSmoke() { sctx.clearRect(0, 0, W, H); camera.updateMatrixWorld(); const FOVT = Math.tan(camera.fov * Math.PI / 360); const vis = []; for (const p of puffs) { if (!p.live) continue; _pv.set(p.x, p.y, p.z); const d = camera.position.distanceTo(_pv); _pv.project(camera); if (_pv.z > 1) continue; vis.push({ sx: (_pv.x * .5 + .5) * W, sy: (1 - (_pv.y * .5 + .5)) * H, d, p }); } vis.sort((a, b) => b.d - a.d); for (const o of vis) { const p = o.p; const age = (simTime - p.born) / p.ttl; const wR = p.r0 + (p.r1 - p.r0) * age; const sR = wR * (H * 0.5) / (o.d * FOVT); if (sR < 1.5) continue; const op = Math.min(age / 0.12, 1) * (1 - ss(age, 0.62, 1)) * 0.96; drawCloud(sctx, o.sx, o.sy, sR, p.seed, age * 3 + p.rot, op); } }

  /* ---- afterburner ---- */
  let abGroup = null, abMat = null, abBaseScale = 1;
  function makeAfterburner() {
    abMat = new THREE.LineBasicMaterial({ color: 0xfff0dc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const rings = 7, len = 1.8, segs = [], N = 18;
    for (let i = 0; i < rings; i++) { const t = i / (rings - 1); const x = -t * len; const r = 0.42 * (1 - t * 0.9) + 0.03; for (let k = 0; k < N; k++) { const a0 = k / N * 6.283, a1 = (k + 1) / N * 6.283; segs.push(x, Math.cos(a0) * r, Math.sin(a0) * r, x, Math.cos(a1) * r, Math.sin(a1) * r); } }
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; segs.push(0, Math.cos(a) * 0.42, Math.sin(a) * 0.42, -len, Math.cos(a) * 0.05, Math.sin(a) * 0.05); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
    abGroup = new THREE.Group(); const ls = new THREE.LineSegments(geo, abMat); ls.frustumCulled = false; abGroup.add(ls); abGroup.visible = false;
  }
  /* ---- track + curbs ---- */
  let trackGroup = null, trackMat = null; const trackBase = new THREE.Vector3(), trackFwd = new THREE.Vector3(0, 0, 1);
  function makeTrack() {
    trackMat = new THREE.LineBasicMaterial({ color: 0xECE6D8, transparent: true, opacity: 0 });
    const segs = [], halfW = 7, L = 220, tie = 5, bend = 26;
    const cx = (z) => { if (z >= -30) return 0; const t = (z + 30) / (L / 2 + 30); return bend * t * t; };
    for (let z = -L / 2; z < L / 2 - 2; z += 2) { const z2 = z + 2, c = cx(z), c2 = cx(z2); segs.push(-halfW + c, 0, z, -halfW + c2, 0, z2, halfW + c, 0, z, halfW + c2, 0, z2); }
    for (let z = -L / 2; z < L / 2; z += 6) segs.push(cx(z), 0, z, cx(z + 3), 0, z + 3);
    for (let z = -L / 2; z < L / 2; z += tie) { const c = cx(z); segs.push(-halfW + c, 0, z, halfW + c, 0, z); }
    for (let z = -L / 2; z < L / 2; z += 6) { if (((z / 6) | 0) % 2) continue; const c = cx(z), c1 = cx(z + 6); for (const sx of [-1, 1]) { const x0 = sx * halfW, x1 = sx * (halfW + 1.4), y = 0.5; segs.push(x0 + c, 0, z, x1 + c, 0, z, x1 + c, 0, z, x1 + c, y, z, x1 + c, y, z, x0 + c, y, z, x0 + c, 0, z, x0 + c1, 0, z + 6, x1 + c, 0, z, x1 + c1, 0, z + 6, x1 + c, y, z, x1 + c1, y, z + 6, x0 + c1, 0, z + 6, x1 + c1, 0, z + 6, x1 + c1, 0, z + 6, x1 + c1, y, z + 6); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
    trackGroup = new THREE.Group(); const ls = new THREE.LineSegments(geo, trackMat); ls.frustumCulled = false; trackGroup.add(ls); trackGroup.visible = false; scene.add(trackGroup);
  }
  function updateExtras() {
    if (abGroup) { if (state.burner > 0.001) { abGroup.visible = true; const fl = 0.7 + 0.3 * Math.sin(simTime * 45) + 0.15 * Math.sin(simTime * 97); abMat.opacity = state.burner * Math.max(0, fl); abGroup.scale.setScalar(abBaseScale * (0.92 + 0.16 * fl)); } else abGroup.visible = false; }
    if (trackGroup) { if (state.track > 0.001) { trackGroup.visible = true; trackMat.opacity = state.track * 0.9; trackGroup.position.copy(trackBase).addScaledVector(trackFwd, state.trackScroll); } else trackGroup.visible = false; }
  }

  /* ---- postprocessing ---- */
  composer = new EffectComposer(renderer); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.38, 0.5, 0.35); composer.addPass(bloom);
  const Grade = { uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.05 }, uVig: { value: 1 }, uFlash: { value: 0 } },
    vertexShader: "varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
    fragmentShader: "uniform sampler2D tDiffuse; uniform float uTime,uGrain,uVig,uFlash; varying vec2 v; float r(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);} void main(){ vec3 c=texture2D(tDiffuse,v).rgb; c=(c-0.5)*1.08+0.5; c=mix(c,vec3(1.0),uFlash); float d=distance(v,vec2(0.5)); c*=mix(1.0,smoothstep(0.95,0.35,d),uVig); c+=(r(v*vec2(1280.0,720.0)+uTime)-0.5)*uGrain; gl_FragColor=vec4(c,1.0);} " };
  const grade = new ShaderPass(Grade); grade.renderToScreen = true; composer.addPass(grade);

  const state = { shake: 0, flash: 0, smokeRate: 0, burner: 0, track: 0, trackScroll: 0 };
  let simTime = 0, tl = null;

  function step(dt) {
    simTime += dt;
    if (state.smokeRate > 0) { const per = state.smokeRate * dt; for (let i = 0; i < per; i++) emitPuff(); }
    updateSmoke(dt); updateExtras();
    const a = state.shake;
    const px = Math.sin(simTime * 13) * 0.6 + Math.sin(simTime * 33.7) * 0.3 + Math.sin(simTime * 61) * 0.14;
    const py = Math.cos(simTime * 11.3) * 0.6 + Math.cos(simTime * 31.1) * 0.3 + Math.cos(simTime * 57) * 0.14;
    camera.position.set(dolly.position.x + px * 0.08 * a, dolly.position.y + py * 0.08 * a, dolly.position.z);
    camera.up.set(0, 1, 0); camera.lookAt(look); camera.rotateZ(px * 0.012 * a);
    grade.uniforms.uTime.value = simTime; grade.uniforms.uFlash.value = state.flash;
  }
  const clock = new THREE.Clock();
  function tick() { if (ended) return; const dt = Math.min(clock.getDelta(), 0.05); step(dt); composer.render(); drawSmoke(); raf = requestAnimationFrame(tick); }

  function buildTimeline() {
    tl = gsap.timeline({ onComplete: end });
    const R = vehicles.rocket.mat.uniforms.uReveal, J = vehicles.jet.mat.uniforms.uReveal, C = vehicles.car.mat.uniforms.uReveal;
    tl.set(dolly.position, { x: 5, y: -1.5, z: 13 }, 0); tl.set(look, { x: 0, y: -2.6, z: 0 }, 0);
    tl.to(R, { value: 1.15, duration: 1.5, ease: "power2.inOut" }, 0.15);
    tl.to(state, { shake: 2.0, duration: 0.5 }, 0.3);
    tl.to(state, { smokeRate: 55, duration: 0.25 }, 0.45);
    tl.to(state, { smokeRate: 28, duration: 1.0 }, 1.3);
    tl.to(state, { smokeRate: 0, duration: 0.5 }, 1.9);
    tl.to(dolly.position, { x: 4, y: 6, z: 11, duration: 1.7, ease: "sine.inOut" }, 0);
    tl.to(look, { x: 0, y: 3, z: 0, duration: 1.7, ease: "sine.inOut" }, 0);
    tl.to(state, { shake: 0.35, duration: 0.6 }, 1.7);
    tl.to(dolly.position, { x: 20, y: 26, z: -20, duration: 1.7, ease: "power1.inOut" }, 1.7);
    tl.to(look, { x: 14, y: 25, z: -34, duration: 1.7, ease: "power1.inOut" }, 1.7);
    tl.to(J, { value: 1.15, duration: 1.3, ease: "power2.out" }, 2.3);
    tl.to(state, { burner: 1, duration: 0.5, ease: "power2.out" }, 2.7);
    tl.to(state, { burner: 0, duration: 0.4 }, 4.6);
    tl.to(dolly.position, { x: 5, y: 27, z: -27, duration: 1.4, ease: "sine.inOut" }, 3.4);
    tl.to(vehicles.jet.grp.rotation, { y: -0.35, duration: 2.6, ease: "sine.inOut" }, 2.4);
    tl.to(dolly.position, { x: 34, y: -10, z: -60, duration: 1.7, ease: "power1.inOut" }, 4.8);
    tl.to(look, { x: 30, y: -14, z: -74, duration: 1.7, ease: "power1.inOut" }, 4.8);
    tl.to(C, { value: 1.15, duration: 1.3, ease: "power2.out" }, 5.4);
    tl.to(state, { track: 1, duration: 0.4, ease: "power2.out" }, 5.35);
    tl.to(state, { trackScroll: 100, duration: 3.3, ease: "power1.in" }, 5.4);
    tl.to(dolly.position, { x: 20, y: -11.4, z: -64, duration: 1.1, ease: "sine.inOut" }, 6.5);
    tl.to(dolly.position, { x: 33, y: -12.8, z: -66, duration: 1.1, ease: "sine.inOut" }, 7.6);
    tl.to(dolly.position, { x: 30.2, y: -13.8, z: -70, duration: 0.5, ease: "power1.in" }, 8.6);
    tl.to(state, { shake: 0.9, duration: 0.5 }, 8.1);
    tl.to(state, { flash: 1, duration: 0.22, ease: "power2.in" }, 8.6);
    tl.to({}, { duration: 0.35 }, 8.9);
  }

  function dispose() {
    try { cancelAnimationFrame(raf); } catch (e) {}
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
    try { composer.dispose && composer.dispose(); } catch (e) {}
    try { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } catch (e) {}
  }
  function resize() { W = innerWidth; H = innerHeight; camera.aspect = W / H; camera.fov = (W / H < 1) ? 62 : 44; /* widen in portrait so wide subjects fit */ camera.updateProjectionMatrix(); renderer.setSize(W, H, false); composer.setSize(W, H); smokeCanvas.width = W; smokeCanvas.height = H; }
  addEventListener("resize", resize);

  /* failsafe: never leave the viewer stuck on the intro */
  const failsafe = setTimeout(end, 15000);

  try {
    await Promise.all([buildVehicle("rocket"), buildVehicle("jet"), buildVehicle("car")]);
  } catch (e) { clearTimeout(failsafe); end(); return; }
  if (ended) { clearTimeout(failsafe); return; }

  note.remove();
  makeAfterburner(); makeTrack();
  const jet = vehicles.jet; jet.grp.add(abGroup); abGroup.position.set(-jet.size.x * 0.42, -jet.size.y * 0.13, 0); abBaseScale = 1 / jet.s; abGroup.scale.setScalar(abBaseScale);
  const car = vehicles.car; const cyy = car.grp.position.y - car.size.y * 0.5 * car.s + 0.25;
  trackBase.set(car.grp.position.x, cyy, car.grp.position.z); trackGroup.rotation.y = -0.15; trackGroup.position.copy(trackBase); trackFwd.set(0, 0, -1).applyEuler(trackGroup.rotation);
  resize(); buildTimeline(); tick();
  tl.eventCallback("onComplete", function () { clearTimeout(failsafe); end(); });
})();
