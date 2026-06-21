/* =============================================================
   Cameron Roberts — interaction layer
   - Lenis inertia scroll (disabled under prefers-reduced-motion)
   - GSAP scroll reveals (gated on motion)
   - Accessible "system schematic" wired to the project index
   - Sticky-header hairline toggle
   All enhancements are progressive: the page is fully usable
   with no JS and with reduced motion.
   ============================================================= */
(function () {
  "use strict";

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = motionQuery.matches;
  var hasGSAP = typeof window.gsap !== "undefined";
  var hasLenis = typeof window.Lenis !== "undefined";

  /* ---------- current year (JS enhances the hardcoded fallback) ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- sticky header hairline ---------- */
  var topbar = document.querySelector(".topbar");
  function onScrollHeader() {
    if (!topbar) return;
    topbar.classList.toggle("is-stuck", window.scrollY > 8);
  }
  onScrollHeader();
  window.addEventListener("scroll", onScrollHeader, { passive: true });

  /* ---------- smooth scroll (Lenis) ---------- */
  var lenis = null;
  if (hasLenis && !reduce) {
    lenis = new window.Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true
    });
    document.documentElement.classList.add("has-lenis");
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    if (hasGSAP && window.ScrollTrigger) {
      lenis.on("scroll", window.ScrollTrigger.update);
    }
  }

  /* in-page anchor scrolling that respects Lenis + reduced motion */
  function scrollToTarget(target, focusEl) {
    var behavior = reduce ? "auto" : "smooth";
    if (lenis) {
      lenis.scrollTo(target, { offset: -64 });
    } else {
      target.scrollIntoView({ behavior: behavior, block: "start" });
    }
    if (focusEl) {
      // move focus after the scroll settles so keyboard users land on content
      window.setTimeout(function () {
        focusEl.setAttribute("tabindex", "-1");
        focusEl.focus({ preventScroll: true });
      }, reduce ? 0 : 650);
    }
  }

  // wire up header / hero anchor links through Lenis
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
     SCHEMATIC — build accessible module nodes + PCB-style wires
     ============================================================= */
  var MODULES = [
    { id: "astra",   code: "PYLD-04", title: "A.S.T.R.A.",  sub: "tracking · docking", tag: "Solo", solo: true },
    { id: "tpmania", code: "PYLD-03", title: "TPMania",     sub: "rhythm · arcade",   tag: "Team", solo: false },
    { id: "loggy",   code: "PYLD-02", title: "LoggyBoard",  sub: "data acquisition",  tag: "Team", solo: false },
    { id: "card",    code: "PYLD-01", title: "PCB Card",    sub: "rf · nfc",          tag: "Solo", solo: true }
  ];

  var schematic = document.getElementById("schematic");
  var wires = schematic ? schematic.querySelector(".schematic__wires") : null;
  var core = schematic ? schematic.querySelector(".node--core") : null;
  var SVGNS = "http://www.w3.org/2000/svg";
  var nodeEls = [];

  function buildSchematic() {
    if (!schematic || !wires || !core) return;
    schematic.removeAttribute("hidden");

    MODULES.forEach(function (m, i) {
      var a = document.createElement("a");
      a.className = "node node--module";
      a.href = "#" + m.id;
      a.setAttribute("data-pos", String(i));
      a.setAttribute("data-target", m.id);
      // The visible title is the accessible name (passes WCAG 2.5.3);
      // the code/sub/tag are decorative duplicates of the entry below.
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

      // hover/focus lights the matching trace
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
    return { x: b.left - sb.left + b.width / 2, y: b.top - sb.top + b.height / 2, b: b, sb: sb };
  }

  var paths = [];
  function drawWires() {
    if (!wires || !core) return;
    wires.innerHTML = "";
    paths = [];
    var sb = schematic.getBoundingClientRect();
    wires.setAttribute("viewBox", "0 0 " + sb.width + " " + sb.height);
    var c = center(core);

    nodeEls.forEach(function (n, i) {
      var p = center(n);
      // elbow: out horizontally from core, then vertically into the module
      var d = "M " + c.x.toFixed(1) + " " + c.y.toFixed(1) +
              " H " + p.x.toFixed(1) +
              " V " + p.y.toFixed(1);
      var path = document.createElementNS(SVGNS, "path");
      path.setAttribute("d", d);
      wires.appendChild(path);

      // via dot at the bend
      var via = document.createElementNS(SVGNS, "circle");
      via.setAttribute("cx", p.x.toFixed(1));
      via.setAttribute("cy", c.y.toFixed(1));
      via.setAttribute("r", "3");
      wires.appendChild(via);

      paths.push({ path: path, via: via });

      // draw-on animation
      var len = path.getTotalLength();
      if (hasGSAP && !reduce) {
        window.gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
        window.gsap.to(path, {
          strokeDashoffset: 0,
          duration: 1.1,
          delay: 0.15 + i * 0.12,
          ease: "power2.out",
          scrollTrigger: { trigger: schematic, start: "top 75%" }
        });
        window.gsap.from(via, {
          scale: 0, transformOrigin: "center",
          duration: 0.4, delay: 0.7 + i * 0.12,
          scrollTrigger: { trigger: schematic, start: "top 75%" }
        });
      }
    });
  }

  function setLive(i, on) {
    if (!paths[i]) return;
    paths[i].path.classList.toggle("is-live", on);
    paths[i].via.classList.toggle("is-live", on);
  }

  /* =============================================================
     SCROLL REVEALS (GSAP) — only when motion is allowed
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
        trigger: el,
        start: "top 88%",
        once: true,
        onEnter: function () { el.classList.add("is-in"); }
      });
    });
  }

  /* ---------- resize: redraw wires, refresh triggers ---------- */
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (window.innerWidth > 880) drawWires();
      if (hasGSAP && window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 200);
  });

  /* ---------- react if the user toggles reduced-motion at runtime ---------- */
  function onMotionChange() {
    if (motionQuery.matches && lenis) { lenis.destroy(); lenis = null; }
    // simplest correct behavior for the rest is a reload-free no-op;
    // content is already visible, so nothing breaks.
  }
  if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);

  /* ---------- go ---------- */
  function start() {
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
