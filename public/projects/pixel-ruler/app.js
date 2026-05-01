(() => {
  "use strict";

  // ---------- State ----------
  const CARD_WIDTH_MM = 85.6;
  const STORAGE_KEY = "pixelRuler.pxPerMm";

  const state = {
    length: 200,
    width: 1,
    angle: 0,
    mode: "css", // 'css' | 'physical'
    pxPerMm: Number(localStorage.getItem(STORAGE_KEY)) || null,
  };

  // ---------- Elements ----------
  const $ = (id) => document.getElementById(id);
  const lengthInput = $("length");
  const lengthRange = $("lengthRange");
  const widthInput = $("width");
  const widthRange = $("widthRange");
  const angleInput = $("angle");
  const angleRange = $("angleRange");
  const shape = $("shape");
  const canvas = $("canvas");
  const canvasSize = $("canvasSize");
  const readoutMain = $("readoutMain");
  const readoutSub = $("readoutSub");
  const modeCssBtn = $("modeCss");
  const modePhysicalBtn = $("modePhysical");
  const modeHint = $("modeHint");
  const calibrateBtn = $("calibrateBtn");

  // Calibration modal
  const calModal = $("calModal");
  const calCard = $("calCard");
  const calHandle = $("calHandle");
  const calReadout = $("calReadout");
  const calCancel = $("calCancel");
  const calReset = $("calReset");
  const calSave = $("calSave");

  // ---------- Helpers ----------
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const parseNum = (el, fallback) => {
    const n = Number(el.value);
    return Number.isFinite(n) ? n : fallback;
  };
  const mmToIn = (mm) => mm / 25.4;

  // ---------- Render ----------
  function render() {
    const scale = state.mode === "physical" && state.pxPerMm ? state.pxPerMm / cssPxPerMm() : 1;

    const w = Math.max(0, state.length) * scale;
    const h = Math.max(0, state.width) * scale;

    shape.style.width = `${w}px`;
    shape.style.height = `${h}px`;
    shape.style.transform = `translate(-50%, -50%) rotate(${state.angle}deg)`;

    const angleTxt = Number.isInteger(state.angle) ? `${state.angle}` : state.angle.toFixed(1);
    readoutMain.textContent = `${state.length} \u00d7 ${state.width} px \u00b7 ${angleTxt}\u00b0`;

    if (state.mode === "physical" && state.pxPerMm) {
      const mm = state.length / state.pxPerMm;
      readoutSub.textContent = `\u2248 ${mm.toFixed(1)} mm (${mmToIn(mm).toFixed(2)} in) on this screen`;
    } else if (state.pxPerMm) {
      const mm = state.length / state.pxPerMm;
      readoutSub.textContent = `CSS pixels \u00b7 calibration available (\u2248 ${mm.toFixed(1)} mm)`;
    } else {
      readoutSub.textContent =
        state.mode === "physical"
          ? "Not calibrated yet \u2014 click Calibrate\u2026 to set physical scale."
          : "CSS pixels \u2014 exactly what ships in your design.";
    }

    updateCanvasSize();
  }

  // We treat "CSS px per mm" as 1 when the user hasn't calibrated, so the
  // physical-mode scale factor above is just pxPerMm (stored) vs assumed.
  // This keeps it simple: physical mode only changes rendering when calibrated.
  function cssPxPerMm() {
    // Browsers spec ~96 CSS px per inch -> 96 / 25.4 per mm.
    return 96 / 25.4;
  }

  function updateCanvasSize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvasSize.textContent = `Canvas: ${Math.round(rect.width)} \u00d7 ${Math.round(rect.height)} px`;
  }

  // ---------- Input wiring ----------
  function bindPair(numberEl, rangeEl, key, { min, max }) {
    const sync = (val) => {
      const clamped = clamp(val, min, max);
      state[key] = clamped;
      if (document.activeElement !== numberEl) numberEl.value = String(clamped);
      if (document.activeElement !== rangeEl) rangeEl.value = String(clamp(clamped, Number(rangeEl.min), Number(rangeEl.max)));
      render();
    };

    numberEl.addEventListener("input", () => sync(parseNum(numberEl, state[key])));
    rangeEl.addEventListener("input", () => sync(parseNum(rangeEl, state[key])));
  }

  bindPair(lengthInput, lengthRange, "length", { min: 1, max: 4000 });
  bindPair(widthInput, widthRange, "width", { min: 1, max: 4000 });
  bindPair(angleInput, angleRange, "angle", { min: -180, max: 180 });

  // Angle quick buttons
  document.querySelectorAll(".chip[data-angle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = Number(btn.dataset.angle);
      state.angle = a;
      angleInput.value = String(a);
      angleRange.value = String(a);
      render();
    });
  });

  // Preset lengths
  document.querySelectorAll(".preset[data-length]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const len = Number(btn.dataset.length);
      state.length = len;
      lengthInput.value = String(len);
      lengthRange.value = String(clamp(len, 1, 2000));
      render();
    });
  });

  // Mode toggle
  function setMode(mode) {
    state.mode = mode;
    const isCss = mode === "css";
    modeCssBtn.classList.toggle("active", isCss);
    modePhysicalBtn.classList.toggle("active", !isCss);
    modeCssBtn.setAttribute("aria-pressed", String(isCss));
    modePhysicalBtn.setAttribute("aria-pressed", String(!isCss));
    calibrateBtn.classList.toggle("hidden", isCss);

    if (isCss) {
      modeHint.textContent = "CSS pixels \u2014 matches what gets shipped. Dead accurate in designs.";
    } else if (state.pxPerMm) {
      modeHint.textContent = `Physical size \u2014 calibrated (${state.pxPerMm.toFixed(2)} px/mm).`;
    } else {
      modeHint.textContent = "Physical size \u2014 click Calibrate\u2026 to set the real-world scale.";
    }
    render();
  }

  modeCssBtn.addEventListener("click", () => setMode("css"));
  modePhysicalBtn.addEventListener("click", () => setMode("physical"));
  calibrateBtn.addEventListener("click", openCalibration);

  // ---------- Calibration modal ----------
  let calCardWidthPx = 340; // current width of the calibration card while user drags

  function openCalibration() {
    // Seed width from existing calibration (if any) so returning users see their setting
    if (state.pxPerMm) {
      calCardWidthPx = state.pxPerMm * CARD_WIDTH_MM;
    }
    applyCalCardWidth(calCardWidthPx);
    calModal.classList.remove("hidden");
    document.addEventListener("keydown", onCalKey);
  }

  function closeCalibration() {
    calModal.classList.add("hidden");
    document.removeEventListener("keydown", onCalKey);
  }

  function onCalKey(e) {
    if (e.key === "Escape") closeCalibration();
    if (document.activeElement === calHandle) {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        applyCalCardWidth(calCardWidthPx + (e.shiftKey ? 10 : 1));
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        applyCalCardWidth(calCardWidthPx - (e.shiftKey ? 10 : 1));
        e.preventDefault();
      }
    }
  }

  function applyCalCardWidth(px) {
    calCardWidthPx = clamp(px, 100, 900);
    calCard.style.width = `${calCardWidthPx}px`;
    const pxPerMm = calCardWidthPx / CARD_WIDTH_MM;
    calReadout.textContent =
      `${calCardWidthPx.toFixed(0)} px wide \u2192 ${pxPerMm.toFixed(2)} CSS px/mm ` +
      `(\u2248 ${(pxPerMm * 25.4).toFixed(0)} PPI)`;
  }

  // Drag to resize
  (function wireDrag() {
    let startX = 0;
    let startW = 0;
    let dragging = false;

    const onPointerDown = (e) => {
      dragging = true;
      startX = e.clientX;
      startW = calCardWidthPx;
      calHandle.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      applyCalCardWidth(startW + (e.clientX - startX));
    };
    const onPointerUp = (e) => {
      dragging = false;
      calHandle.releasePointerCapture?.(e.pointerId);
    };

    calHandle.addEventListener("pointerdown", onPointerDown);
    calHandle.addEventListener("pointermove", onPointerMove);
    calHandle.addEventListener("pointerup", onPointerUp);
    calHandle.addEventListener("pointercancel", onPointerUp);
  })();

  calCancel.addEventListener("click", closeCalibration);
  calReset.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state.pxPerMm = null;
    applyCalCardWidth(CARD_WIDTH_MM * cssPxPerMm()); // default to spec-assumed 96 DPI
    setMode(state.mode); // refresh hint
  });
  calSave.addEventListener("click", () => {
    const pxPerMm = calCardWidthPx / CARD_WIDTH_MM;
    state.pxPerMm = pxPerMm;
    localStorage.setItem(STORAGE_KEY, String(pxPerMm));
    closeCalibration();
    setMode("physical");
  });

  // Click backdrop to close
  calModal.addEventListener("click", (e) => {
    if (e.target === calModal) closeCalibration();
  });

  // ---------- Init ----------
  window.addEventListener("resize", updateCanvasSize);
  setMode("css");
  render();
})();
