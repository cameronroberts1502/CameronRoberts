/* =============================================================
   Cameron Roberts — interaction layer
   - Native scroll (no smooth-scroll hijack)
   - GSAP scroll reveals + masked title load animation
   - Accessible "system schematic" with live signal pulses
   - Sticky-header hairline toggle
   Progressive: fully usable with no JS and with reduced motion.
   ============================================================= */
(function () {
  "use strict";

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = motionQuery.matches;
  var hasGSAP = typeof window.gsap !== "undefined";
  var pulseTweens = [];

  /* ---------- current year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- sticky header hairline ---------- */
  var topbar = document.querySelector(".topbar");
  function onScrollHeader() {
    if (topbar) topbar.classList.toggle("is-stuck", window.scrollY > 8);
  }
  onScrollHeader();
  window.addEventListener("scroll", onScrollHeader, { passive: true });

  /* ---------- in-page anchor scrolling (native, motion-aware) ---------- */
  function scrollToTarget(target, focusEl) {
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    if (focusEl) {
      focusEl.setAttribute("tabindex", "-1");
      focusEl.focus({ preventScroll: true }); // land keyboard users on the target
    }
  }
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      scrollToTarget(target);
      history.replaceState(null, "", id);
    });
  });

  /* =============================================================
     SCHEMATIC
     ============================================================= */
  var MODULES = [
    { id: "astra",   code: "PYLD-04", title: "A.S.T.R.A.",  sub: "tracking · docking", tag: "Team", solo: false },
    { id: "tpmania", code: "PYLD-03", title: "TPMania",     sub: "rhythm · arcade",   tag: "Team", solo: false },
    { id: "loggy",   code: "PYLD-02", title: "LoggyBoard",  sub: "data acquisition",  tag: "Team", solo: false },
    { id: "card",    code: "PYLD-01", title: "PCB Card",    sub: "rf · nfc",          tag: "Solo", solo: true }
  ];

  var schematic = document.getElementById("schematic");
  var wires = schematic ? schematic.querySelector(".schematic__wires") : null;
  var core = schematic ? schematic.querySelector(".node--core") : null;
  var SVGNS = "http://www.w3.org/2000/svg";
  var nodeEls = [];
  var paths = [];

  function buildSchematic() {
    if (!schematic || !wires || !core) return;
    schematic.removeAttribute("hidden");

    MODULES.forEach(function (m, i) {
      var a = document.createElement("a");
      a.className = "node node--module";
      a.href = "#" + m.id;
      a.setAttribute("data-pos", String(i));
      // visible title is the accessible name (WCAG 2.5.3); rest decorative
      a.innerHTML =
        '<span class="node__id" aria-hidden="true">' + m.code + '</span>' +
        '<span class="node__title">' + m.title + '</span>' +
        '<span class="node__sub" aria-hidden="true">' + m.sub + '</span>' +
        '<span class="tag' + (m.solo ? " tag--solo" : "") + '" aria-hidden="true">' + m.tag + '</span>';

      a.addEventListener("click", function (e) {
        e.preventDefault();
        var entry = document.getElementById(m.id);
        if (!entry) return;
        document.querySelectorAll(".entry.is-target").forEach(function (el) {
          el.classList.remove("is-target");
        });
        entry.classList.add("is-target");
        scrollToTarget(entry, entry);
        history.replaceState(null, "", "#" + m.id);
      });

      a.addEventListener("mouseenter", function () { setLive(i, true); });
      a.addEventListener("mouseleave", function () { setLive(i, false); });
      a.addEventListener("focus", function () { setLive(i, true); });
      a.addEventListener("blur", function () { setLive(i, false); });

      schematic.appendChild(a);
      nodeEls.push(a);
    });

    drawWires();
  }

  function center(el) {
    var sb = schematic.getBoundingClientRect();
    var b = el.getBoundingClientRect();
    return { x: b.left - sb.left + b.width / 2, y: b.top - sb.top + b.height / 2 };
  }

  function killPulses() {
    pulseTweens.forEach(function (t) { t.kill(); });
    pulseTweens = [];
  }

  function drawWires() {
    if (!wires || !core) return;
    killPulses();
    wires.innerHTML = "";
    paths = [];
    var sb = schematic.getBoundingClientRect();
    wires.setAttribute("viewBox", "0 0 " + sb.width + " " + sb.height);
    var c = center(core);

    nodeEls.forEach(function (n, i) {
      var p = center(n);
      var d = "M " + c.x.toFixed(1) + " " + c.y.toFixed(1) +
              " H " + p.x.toFixed(1) +
              " V " + p.y.toFixed(1);

      var path = document.createElementNS(SVGNS, "path");
      path.setAttribute("d", d);
      wires.appendChild(path);

      var via = document.createElementNS(SVGNS, "circle");
      via.setAttribute("cx", p.x.toFixed(1));
      via.setAttribute("cy", c.y.toFixed(1));
      via.setAttribute("r", "3");
      wires.appendChild(via);

      // travelling signal pulse (overlay path, motion-gated)
      var pulse = null;
      if (hasGSAP && !reduce) {
        pulse = document.createElementNS(SVGNS, "path");
        pulse.setAttribute("d", d);
        pulse.setAttribute("class", "pulse");
        wires.appendChild(pulse);
      }

      paths.push({ path: path, via: via, pulse: pulse });

      var len = path.getTotalLength();
      if (hasGSAP && !reduce) {
        window.gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
        window.gsap.to(path, {
          strokeDashoffset: 0, duration: 1.1, delay: 0.15 + i * 0.12, ease: "power2.out",
          scrollTrigger: { trigger: schematic, start: "top 78%" }
        });
        window.gsap.from(via, {
          attr: { r: 0 }, duration: 0.4, delay: 0.75 + i * 0.12,
          scrollTrigger: { trigger: schematic, start: "top 78%" }
        });

        // pulse: a short bright dash that runs the length of the trace, on a loop
        var seg = 26;
        window.gsap.set(pulse, { strokeDasharray: seg + " " + (len + seg), strokeDashoffset: len + seg });
        var t = window.gsap.to(pulse, {
          strokeDashoffset: -seg, duration: 2.2 + i * 0.25, ease: "none",
          repeat: -1, delay: i * 0.5,
          scrollTrigger: { trigger: schematic, start: "top bottom", end: "bottom top", toggleActions: "play pause resume pause" }
        });
        pulseTweens.push(t);
      }
    });
  }

  function setLive(i, on) {
    if (!paths[i]) return;
    paths[i].path.classList.toggle("is-live", on);
    paths[i].via.classList.toggle("is-live", on);
  }

  /* =============================================================
     TITLE — masked load reveal
     ============================================================= */
  function initTitle() {
    var lines = document.querySelectorAll(".hero__title .line");
    if (!lines.length) return;
    if (reduce) { lines.forEach(function (l) { l.classList.add("is-in"); }); return; }
    // CSS-transition driven (compositor, not RAF) so it can't get stuck hidden
    lines.forEach(function (l, i) {
      setTimeout(function () { l.classList.add("is-in"); }, 150 + i * 140);
    });
  }

  /* =============================================================
     SCROLL REVEALS
     ============================================================= */
  function initReveals() {
    var els = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    if (!els.length) return;
    if (!hasGSAP || reduce) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    window.gsap.registerPlugin(window.ScrollTrigger);
    els.forEach(function (el) {
      window.ScrollTrigger.create({
        trigger: el, start: "top 88%", once: true,
        onEnter: function () { el.classList.add("is-in"); }
      });
    });
  }

  /* ---------- resize ---------- */
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (window.innerWidth > 880) drawWires();
      if (hasGSAP && window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 200);
  });

  /* ---------- runtime reduced-motion toggle ---------- */
  function onMotionChange() {
    if (motionQuery.matches) {
      reduce = true;
      killPulses();
      document.querySelectorAll(".schematic__wires path.pulse").forEach(function (el) { el.remove(); });
      document.querySelectorAll("[data-reveal]").forEach(function (el) { el.classList.add("is-in"); });
      document.querySelectorAll(".hero__title .line").forEach(function (el) { el.classList.add("is-in"); });
    }
  }
  if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);

  /* ---------- go ---------- */
  function start() {
    initTitle();
    buildSchematic();
    initReveals();
    if (hasGSAP && window.ScrollTrigger) window.ScrollTrigger.refresh();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
