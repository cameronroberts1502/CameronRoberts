/* =============================================================
   Cameron Roberts — interaction layer (no animation library)
   - Glitch/scanline loader (CSS-driven), dismissed on a finite timer
   - IntersectionObserver scroll reveals
   - Project detail via native <dialog> (focus mgmt + scroll lock)
   - Fully gated on prefers-reduced-motion; degrades with no JS
   ============================================================= */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());

  /* in-page anchors */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href"); if (!id || id === "#") return;
      var t = document.querySelector(id); if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true });
      history.replaceState(null, "", id);
    });
  });

  /* scroll reveals */
  (function () {
    var els = document.querySelectorAll("[data-reveal]");
    if (!els.length) return;
    if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-in"); }); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.14 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* project dialogs */
  (function () {
    var lastTrigger = null;
    function open(dialog, trigger) {
      if (!dialog || typeof dialog.showModal !== "function") return;
      lastTrigger = trigger; dialog.showModal();
      document.body.classList.add("dialog-open");
      var h = dialog.querySelector(".dlg__title");
      if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
      var body = dialog.querySelector(".dlg__body"); if (body) body.scrollTop = 0;
    }
    document.querySelectorAll("[data-dialog]").forEach(function (trigger) {
      var dialog = document.getElementById(trigger.getAttribute("data-dialog"));
      if (!dialog) return;
      trigger.addEventListener("click", function () { open(dialog, trigger); });
      dialog.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", function () { dialog.close(); }); });
      dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
      dialog.addEventListener("close", function () {
        document.body.classList.remove("dialog-open");
        if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
      });
    });
  })();

  /* loader: CSS plays the glitch; JS dismisses on a finite timer (never on an
     animation event), un-inerting the page. */
  var loader = document.getElementById("loader");
  var main = document.getElementById("main");
  var dismissed = false;
  function dismiss() { if (dismissed) return; dismissed = true; if (main) main.removeAttribute("inert"); if (loader && loader.parentNode) loader.parentNode.removeChild(loader); }

  if (!loader) { /* none */ }
  else if (reduce) { dismiss(); }
  else {
    if (main) main.setAttribute("inert", "");
    loader.addEventListener("transitionend", function (e) { if (e.propertyName === "clip-path") dismiss(); });
    setTimeout(function () { loader.classList.add("is-out"); }, 1700); // start exit wipe
    setTimeout(dismiss, 3200); // failsafe (never tied to animation completion)
  }

  /* console easter egg: a note for the curious recruiter or dev who opens devtools */
  try {
    console.log("%c[ CAMERON ROBERTS // transmission received", "color:#ECE6D8;font:700 14px ui-monospace,monospace");
    console.log("%c  you opened the console. that's the kind of curiosity i build for.\n  hardware end to end, currently open to roles.\n  cameron.roberts1502@gmail.com", "color:#9a958a;font:12px ui-monospace,monospace");
  } catch (e) {}

  /* konami code -> a brief "cleared for launch" transmission overlay (hidden, optional) */
  (function () {
    var seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65], i = 0, firing = false;
    function fire() {
      if (firing) return; firing = true;
      var o = document.createElement("div");
      o.className = "egg"; o.setAttribute("aria-hidden", "true");
      o.innerHTML = '<span class="egg__t" data-text="Cleared for launch">Cleared for launch</span>';
      document.body.appendChild(o);
      requestAnimationFrame(function () { o.classList.add("egg--in"); });
      setTimeout(function () { o.classList.add("egg--out"); }, reduce ? 1400 : 2100);
      setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); firing = false; }, reduce ? 1800 : 2700);
    }
    document.addEventListener("keydown", function (e) {
      var k = e.keyCode || e.which;
      i = (k === seq[i]) ? i + 1 : (k === seq[0] ? 1 : 0);
      if (i === seq.length) { i = 0; fire(); }
    });
  })();
})();
