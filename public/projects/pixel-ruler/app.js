(() => {
  "use strict";

  // ---------- Constants ----------
  const VERSION = "0.5.2";
  const CARD_WIDTH_MM = 85.6;
  const STORAGE_KEY = "pixelRuler.pxPerMm";
  const SHAPE_TYPES = ["line", "rect", "circle"];
  const TYPE_LABEL = { line: "Line", rect: "Rectangle", circle: "Circle" };

  // ---------- State ----------
  /**
   * Each object:
   *  { id, type: 'line'|'rect'|'circle', x, y, angle,
   *    // line
   *    length?, thickness?,
   *    // rect
   *    width?, height?,
   *    // circle
   *    diameter?
   *  }
   * x,y are pixel offsets from canvas center.
   */
  const state = {
    objects: [],
    activeId: null,
    activeTypeTab: "line", // which tab is currently selected in UI
    circleSizeMode: "diameter", // 'diameter' | 'radius'
    mode: "css", // 'css' | 'physical'
    pxPerMm: Number(localStorage.getItem(STORAGE_KEY)) || null,
    nextId: 1,
    snapEnabled: false,
    snapStep: 10,
  };

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const parseNum = (el, fb) => {
    const n = Number(el.value);
    return Number.isFinite(n) ? n : fb;
  };
  const activeObj = () => state.objects.find((o) => o.id === state.activeId) ?? null;

  // ---------- Elements ----------
  const canvas = $("canvas");
  const addBtn = $("addBtn");
  const tabs = $$(".tab");
  const typeSections = $$(".type-controls");
  const presetsContainers = {
    line: $("presetsLine"),
    rect: $("presetsRect"),
    circle: $("presetsCircle"),
  };

  // Line inputs
  const lineLength = $("lineLength");
  const lineLengthRange = $("lineLengthRange");
  const lineThickness = $("lineThickness");
  const lineThicknessRange = $("lineThicknessRange");
  const lineAngle = $("lineAngle");
  const lineAngleRange = $("lineAngleRange");

  // Rect inputs
  const rectWidth = $("rectWidth");
  const rectWidthRange = $("rectWidthRange");
  const rectHeight = $("rectHeight");
  const rectHeightRange = $("rectHeightRange");
  const rectAngle = $("rectAngle");
  const rectAngleRange = $("rectAngleRange");

  // Circle inputs
  const circleSize = $("circleSize");
  const circleSizeRange = $("circleSizeRange");
  const circleSizeLabel = $("circleSizeLabel");
  const circleModeDiameter = $("circleModeDiameter");
  const circleModeRadius = $("circleModeRadius");

  // Object list
  const objectList = $("objectList");
  const objectCount = $("objectCount");
  const listEmpty = $("listEmpty");
  const clearAllBtn = $("clearAllBtn");

  // Snap toggle
  const snapBtn = $("snapBtn");

  // Readout + canvas footer
  const readoutMain = $("readoutMain");
  const readoutSub = $("readoutSub");
  const canvasSize = $("canvasSize");

  // Mode toggle
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

  // ---------- Object CRUD ----------
  function createObject(type) {
    const id = state.nextId++;
    // Spawn offset so objects don't stack at center
    const offset = state.objects.length * 30;
    const base = { id, type, x: offset, y: offset, angle: 0, visible: true };

    let obj;
    if (type === "line") {
      obj = { ...base, length: 200, thickness: 1 };
    } else if (type === "rect") {
      obj = { ...base, width: 200, height: 100 };
    } else {
      obj = { ...base, diameter: 100 };
    }

    state.objects.push(obj);
    state.activeId = id;
    setActiveTab(type);
    renderAll();
    syncInputsFromActive();
    return obj;
  }

  function toggleVisibility(id) {
    const o = state.objects.find((x) => x.id === id);
    if (!o) return;
    o.visible = !o.visible;
    renderAll();
    updateReadout();
  }

  function deleteObject(id) {
    const idx = state.objects.findIndex((o) => o.id === id);
    if (idx < 0) return;
    state.objects.splice(idx, 1);
    if (state.activeId === id) {
      // Pick neighbor: prefer previous, else next, else null
      const next = state.objects[idx - 1] ?? state.objects[idx] ?? null;
      state.activeId = next ? next.id : null;
      if (next) setActiveTab(next.type);
    }
    renderAll();
    syncInputsFromActive();
  }

  function setActive(id) {
    if (state.activeId === id) return;
    state.activeId = id;
    const o = activeObj();
    if (o) setActiveTab(o.type);
    renderAll();
    syncInputsFromActive();
  }

  function updateActive(patch) {
    const o = activeObj();
    if (!o) return;
    Object.assign(o, patch);
    renderAll();
    updateReadout();
    updateListItem(o);
  }

  // ---------- Tabs / type switching ----------
  function setActiveTab(type) {
    if (!SHAPE_TYPES.includes(type)) return;
    state.activeTypeTab = type;

    for (const tab of tabs) {
      const isActive = tab.dataset.type === type;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    }
    for (const section of typeSections) {
      section.classList.toggle("hidden", section.dataset.type !== type);
    }
    for (const [key, el] of Object.entries(presetsContainers)) {
      el.classList.toggle("hidden", key !== type);
    }
    addBtn.textContent = `+ Add ${type === "rect" ? "rectangle" : type}`;
  }

  // ---------- Syncing inputs <-> active object ----------
  function setInputIfIdle(el, val) {
    // Avoid fighting the user while they're typing
    if (document.activeElement === el) return;
    el.value = String(val);
  }

  function syncInputsFromActive() {
    const o = activeObj();
    if (!o) {
      updateReadout();
      return;
    }

    if (o.type === "line") {
      setInputIfIdle(lineLength, o.length);
      setInputIfIdle(lineLengthRange, clamp(o.length, 1, 2000));
      setInputIfIdle(lineThickness, o.thickness);
      setInputIfIdle(lineThicknessRange, clamp(o.thickness, 1, 200));
      setInputIfIdle(lineAngle, Math.round(o.angle * 10) / 10);
      setInputIfIdle(lineAngleRange, Math.round(clamp(o.angle, -180, 180)));
    } else if (o.type === "rect") {
      setInputIfIdle(rectWidth, o.width);
      setInputIfIdle(rectWidthRange, clamp(o.width, 1, 2000));
      setInputIfIdle(rectHeight, o.height);
      setInputIfIdle(rectHeightRange, clamp(o.height, 1, 2000));
      setInputIfIdle(rectAngle, Math.round(o.angle * 10) / 10);
      setInputIfIdle(rectAngleRange, Math.round(clamp(o.angle, -180, 180)));
    } else if (o.type === "circle") {
      const displayVal = state.circleSizeMode === "diameter" ? o.diameter : o.diameter / 2;
      setInputIfIdle(circleSize, Math.round(displayVal * 10) / 10);
      setInputIfIdle(circleSizeRange, clamp(Math.round(displayVal), 1, 2000));
    }

    updateReadout();
  }

  function updateReadout() {
    const o = activeObj();
    if (!o) {
      readoutMain.textContent = "No active object";
      readoutSub.textContent = "Click an object to select it, or add a new one.";
      return;
    }

    let main;
    if (o.type === "line") main = `Line \u00b7 ${o.length} \u00d7 ${o.thickness} px \u00b7 ${fmtAngle(o.angle)}`;
    else if (o.type === "rect") main = `Rect \u00b7 ${o.width} \u00d7 ${o.height} px \u00b7 ${fmtAngle(o.angle)}`;
    else main = `Circle \u00b7 \u2300 ${o.diameter} px (r ${o.diameter / 2})`;
    if (!o.visible) main += " \u00b7 (hidden)";
    readoutMain.textContent = main;

    if (state.mode === "physical" && state.pxPerMm) {
      const px = o.type === "line" ? o.length : o.type === "rect" ? Math.max(o.width, o.height) : o.diameter;
      const mm = px / state.pxPerMm;
      readoutSub.textContent = `\u2248 ${mm.toFixed(1)} mm (${(mm / 25.4).toFixed(2)} in) on this screen`;
    } else if (state.pxPerMm) {
      readoutSub.textContent = `CSS pixels \u00b7 calibration available (${state.pxPerMm.toFixed(2)} px/mm)`;
    } else {
      readoutSub.textContent = state.mode === "physical"
        ? "Not calibrated yet \u2014 click Calibrate\u2026"
        : "CSS pixels \u2014 matches what ships in your design.";
    }
  }

  function fmtAngle(a) {
    return `${Number.isInteger(a) ? a : a.toFixed(1)}\u00b0`;
  }

  // ---------- Rendering ----------
  const domById = new Map(); // id -> { root, label, handles: { ... } }

  function renderAll() {
    // Remove DOM for deleted objects
    for (const id of [...domById.keys()]) {
      if (!state.objects.find((o) => o.id === id)) {
        domById.get(id).root.remove();
        domById.delete(id);
      }
    }

    // Create/update DOM for each object
    for (const o of state.objects) {
      let entry = domById.get(o.id);
      if (!entry) entry = createShapeDom(o);
      updateShapeDom(entry, o);
    }

    // Update list + readout + add button + canvas size
    renderObjectList();
    updateReadout();
    updateCanvasSize();
  }

  function createShapeDom(o) {
    const root = document.createElement("div");
    root.className = "shape";
    root.dataset.id = String(o.id);
    root.dataset.type = o.type;
    root.dataset.active = "false";
    wireShapePointer(root, o.id);
    canvas.appendChild(root);
    const entry = { root, handles: {}, label: null };
    domById.set(o.id, entry);
    return entry;
  }

  function updateShapeDom(entry, o) {
    const { root } = entry;

    // Hidden objects: take off the canvas entirely (keep DOM so we can restore fast)
    if (!o.visible) {
      root.style.display = "none";
      removeHandlesAndLabel(entry);
      return;
    }
    root.style.display = "";

    const isActive = o.id === state.activeId;
    root.dataset.active = isActive ? "true" : "false";

    // Size
    let w, h;
    if (o.type === "line") {
      w = o.length;
      h = o.thickness;
    } else if (o.type === "rect") {
      w = o.width;
      h = o.height;
    } else {
      w = o.diameter;
      h = o.diameter;
    }
    root.style.width = `${w}px`;
    root.style.height = `${h}px`;

    // Position + rotation
    const angle = o.type === "circle" ? 0 : o.angle;
    root.style.transform =
      `translate(calc(-50% + ${o.x}px), calc(-50% + ${o.y}px)) rotate(${angle}deg)`;

    // Handles + label (only for active)
    if (isActive) ensureHandlesAndLabel(entry, o);
    else removeHandlesAndLabel(entry);

    if (isActive && entry.label) entry.label.textContent = describeForLabel(o);
  }

  function describeForLabel(o) {
    if (o.type === "line") return `Line ${o.length}\u00d7${o.thickness}`;
    if (o.type === "rect") return `Rect ${o.width}\u00d7${o.height}`;
    return `Circle \u2300${o.diameter}`;
  }

  function ensureHandlesAndLabel(entry, o) {
    const { root } = entry;

    // Label
    if (!entry.label) {
      const label = document.createElement("div");
      label.className = "shape-label";
      root.appendChild(label);
      entry.label = label;
    }
    // Counter-rotate the label so it stays upright
    const ang = o.type === "circle" ? 0 : o.angle;
    entry.label.style.setProperty("--counter-rot", `${-ang}deg`);

    // Handles — per-type handle layout
    let wanted;
    if (o.type === "line") {
      wanted = ["start", "end", "rot"];
    } else if (o.type === "rect") {
      wanted = ["tl", "tr", "bl", "br", "t", "b", "l", "r", "rot"];
    } else {
      // circle
      wanted = ["t", "b", "l", "r"];
    }
    // Remove handles that are no longer wanted
    for (const k of Object.keys(entry.handles)) {
      if (!wanted.includes(k)) {
        entry.handles[k].remove();
        delete entry.handles[k];
      }
    }
    for (const pos of wanted) {
      if (!entry.handles[pos]) {
        const h = document.createElement("div");
        h.className = `handle ${pos}`;
        h.dataset.handle = pos;
        wireHandleByRole(h, o, pos);
        root.appendChild(h);
        entry.handles[pos] = h;
      }
    }
  }

  // Pick the right interaction for each handle role.
  function wireHandleByRole(el, o, pos) {
    if (o.type === "line") {
      if (pos === "rot") wireRotateHandle(el, o.id);
      else wireLineEndHandle(el, o.id, pos); // start | end
    } else if (o.type === "rect") {
      if (pos === "rot") wireRotateHandle(el, o.id);
      else if (pos === "tl" || pos === "tr" || pos === "bl" || pos === "br") wireCornerResize(el, o.id, pos);
      else wireEdgeResize(el, o.id, pos);
    } else if (o.type === "circle") {
      wireCircleResize(el, o.id);
    }
  }

  function removeHandlesAndLabel(entry) {
    for (const h of Object.values(entry.handles)) h.remove();
    entry.handles = {};
    if (entry.label) {
      entry.label.remove();
      entry.label = null;
    }
  }

  // ---------- Object list UI ----------
  const listItems = new Map(); // id -> <li>

  function renderObjectList() {
    objectCount.textContent = `(${state.objects.length})`;
    listEmpty.classList.toggle("hidden", state.objects.length > 0);

    // Remove stale list items
    for (const id of [...listItems.keys()]) {
      if (!state.objects.find((o) => o.id === id)) {
        listItems.get(id).remove();
        listItems.delete(id);
      }
    }

    // Create/update items in order
    state.objects.forEach((o, idx) => {
      let li = listItems.get(o.id);
      if (!li) li = createListItem(o);
      updateListItem(o, idx);
      if (li.parentElement !== objectList) objectList.appendChild(li);
      // Ensure order matches state.objects
      objectList.appendChild(li);
    });
  }

  function createListItem(o) {
    const li = document.createElement("li");
    li.className = "object-item";
    li.dataset.id = String(o.id);
    li.dataset.visible = "true";
    li.innerHTML = `
      <button type="button" class="eye-btn" aria-label="Toggle visibility" title="Show / hide on canvas">
        ${iconFor()}
      </button>
      <span class="meta">
        <span class="name"></span>
        <span class="dims"></span>
      </span>
      <button type="button" class="trash" aria-label="Delete" title="Delete">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5L11 4M7 6.5v4M9 6.5v4"/>
        </svg>
      </button>
    `;
    // Row click = make active. Eye/trash clicks don't propagate.
    li.addEventListener("click", (e) => {
      if (e.target.closest(".trash") || e.target.closest(".eye-btn")) return;
      setActive(o.id);
    });
    li.querySelector(".eye-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleVisibility(o.id);
    });
    li.querySelector(".trash").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteObject(o.id);
    });
    listItems.set(o.id, li);
    return li;
  }

  function updateListItem(o, idx) {
    const li = listItems.get(o.id);
    if (!li) return;
    const isActive = o.id === state.activeId;
    li.classList.toggle("active", isActive);
    li.setAttribute("aria-selected", String(isActive));
    li.dataset.visible = o.visible ? "true" : "false";

    if (idx === undefined) idx = state.objects.findIndex((x) => x.id === o.id);

    const name = li.querySelector(".name");
    const dims = li.querySelector(".dims");
    name.textContent = `#${idx + 1} \u00b7 ${TYPE_LABEL[o.type]}`;
    dims.textContent = dimsString(o);
  }

  function dimsString(o) {
    if (o.type === "line") return `${o.length} \u00d7 ${o.thickness} px \u00b7 ${fmtAngle(o.angle)}`;
    if (o.type === "rect") return `${o.width} \u00d7 ${o.height} px \u00b7 ${fmtAngle(o.angle)}`;
    return `\u2300 ${o.diameter} px`;
  }

  // Single eye icon used for all objects.
  // `.eye-pupil` shows on the active row (eye open); `.eye-slash` shows on inactive rows (eye closed).
  function iconFor(/* type */) {
    return `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M1.2 8C3 4.2 5.4 2.8 8 2.8c2.6 0 5 1.4 6.8 5.2-1.8 3.8-4.2 5.2-6.8 5.2-2.6 0-5-1.4-6.8-5.2Z"/>
      <circle class="eye-pupil" cx="8" cy="8" r="1.9" fill="currentColor" stroke="none"/>
      <line class="eye-slash" x1="2.5" y1="2.5" x2="13.5" y2="13.5"/>
    </svg>`;
  }

  // ---------- Input wiring ----------
  function bindPair(numberEl, rangeEl, { min, max }, onChange) {
    const sync = (val) => {
      const v = clamp(val, min, max);
      if (document.activeElement !== numberEl) numberEl.value = String(v);
      if (document.activeElement !== rangeEl) rangeEl.value = String(clamp(v, Number(rangeEl.min), Number(rangeEl.max)));
      onChange(v);
    };
    numberEl.addEventListener("input", () => sync(parseNum(numberEl, 0)));
    rangeEl.addEventListener("input", () => sync(parseNum(rangeEl, 0)));
  }

  // Line
  bindPair(lineLength, lineLengthRange, { min: 1, max: 4000 }, (v) => {
    if (activeObj()?.type === "line") updateActive({ length: v });
  });
  bindPair(lineThickness, lineThicknessRange, { min: 1, max: 4000 }, (v) => {
    if (activeObj()?.type === "line") updateActive({ thickness: v });
  });
  bindPair(lineAngle, lineAngleRange, { min: -180, max: 180 }, (v) => {
    if (activeObj()?.type === "line") updateActive({ angle: v });
  });

  // Rect
  bindPair(rectWidth, rectWidthRange, { min: 1, max: 4000 }, (v) => {
    if (activeObj()?.type === "rect") updateActive({ width: v });
  });
  bindPair(rectHeight, rectHeightRange, { min: 1, max: 4000 }, (v) => {
    if (activeObj()?.type === "rect") updateActive({ height: v });
  });
  bindPair(rectAngle, rectAngleRange, { min: -180, max: 180 }, (v) => {
    if (activeObj()?.type === "rect") updateActive({ angle: v });
  });

  // Circle
  function applyCircleInput(val) {
    if (activeObj()?.type !== "circle") return;
    const diameter = state.circleSizeMode === "diameter" ? val : val * 2;
    updateActive({ diameter });
  }
  bindPair(circleSize, circleSizeRange, { min: 1, max: 4000 }, applyCircleInput);

  circleModeDiameter.addEventListener("click", () => {
    state.circleSizeMode = "diameter";
    circleModeDiameter.classList.add("active");
    circleModeDiameter.setAttribute("aria-pressed", "true");
    circleModeRadius.classList.remove("active");
    circleModeRadius.setAttribute("aria-pressed", "false");
    circleSizeLabel.textContent = "Diameter (px)";
    syncInputsFromActive();
  });
  circleModeRadius.addEventListener("click", () => {
    state.circleSizeMode = "radius";
    circleModeRadius.classList.add("active");
    circleModeRadius.setAttribute("aria-pressed", "true");
    circleModeDiameter.classList.remove("active");
    circleModeDiameter.setAttribute("aria-pressed", "false");
    circleSizeLabel.textContent = "Radius (px)";
    syncInputsFromActive();
  });

  // Angle quick buttons (per type)
  $$(".chip[data-angle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = Number(btn.dataset.angle);
      const type = btn.dataset.angleFor;
      const o = activeObj();
      if (!o || o.type !== type) return;
      updateActive({ angle: a });
      syncInputsFromActive();
    });
  });

  // Presets (type-aware)
  $$(".preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ptype = btn.dataset.presetType;
      const raw = btn.dataset.preset;
      let o = activeObj();
      // If no active obj, or active type doesn't match, create new of that type
      if (!o || o.type !== ptype) {
        o = createObject(ptype);
      }
      if (ptype === "line") {
        updateActive({ length: Number(raw), thickness: 1 });
      } else if (ptype === "rect") {
        const [w, h] = raw.split("x").map(Number);
        updateActive({ width: w, height: h });
      } else if (ptype === "circle") {
        updateActive({ diameter: Number(raw) });
      }
      syncInputsFromActive();
    });
  });

  // Tabs
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.type);
      // Don't switch the active object; the tabs just show what '+ Add' will create
      // and what presets show. If there's an active obj matching the tab, sync inputs.
      syncInputsFromActive();
    });
  });

  addBtn.addEventListener("click", () => {
    createObject(state.activeTypeTab);
  });

  clearAllBtn.addEventListener("click", () => {
    state.objects = [];
    state.activeId = null;
    renderAll();
    syncInputsFromActive();
  });

  snapBtn.addEventListener("click", () => {
    state.snapEnabled = !state.snapEnabled;
    snapBtn.setAttribute("aria-pressed", String(state.snapEnabled));
  });

  // Theme toggle (light/dark). Initial data-theme is set by an inline head script.
  const THEME_KEY = "pixelRuler.theme";
  const themeToggle = $("themeToggle");
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) { /* ignore */ }
  });

  // ---------- Canvas interactions ----------
  function wireShapePointer(root, id) {
    root.addEventListener("pointerdown", (e) => {
      // Handles handle their own pointerdown via stopPropagation
      if (e.target.classList.contains("handle")) return;
      if (state.activeId !== id) setActive(id);
      if (state.activeId !== id) return;

      e.preventDefault();
      const o = state.objects.find((x) => x.id === id);
      if (!o) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const ox = o.x;
      const oy = o.y;
      root.setPointerCapture(e.pointerId);

      attachDrag(root, (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let nx = ox + dx;
        let ny = oy + dy;
        if (state.snapEnabled) {
          const step = state.snapStep;
          nx = Math.round(nx / step) * step;
          ny = Math.round(ny / step) * step;
        }
        updateActive({ x: nx, y: ny });
      });
    });
  }

  // Helper: attach a standard pointer-drag lifecycle (down wiring is caller's responsibility)
  function attachDrag(el, move, up) {
    el.addEventListener("pointermove", move);
    const cleanup = (e) => {
      el.releasePointerCapture?.(e.pointerId);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", cleanup);
      el.removeEventListener("pointercancel", cleanup);
      up?.(e);
    };
    el.addEventListener("pointerup", cleanup);
    el.addEventListener("pointercancel", cleanup);
  }

  // Rotation knob (above the top edge for rectangles). Rotates around shape center.
  function wireRotateHandle(handleEl, id) {
    handleEl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const o = state.objects.find((x) => x.id === id);
      if (!o) return;
      if (state.activeId !== id) setActive(id);

      const rect = domById.get(id).root.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const initialPointerAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
      const anchorOffset = initialPointerAngle - o.angle;

      handleEl.setPointerCapture(e.pointerId);

      attachDrag(handleEl, (ev) => {
        const ang = Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI);
        let next = ang - anchorOffset;
        if (ev.shiftKey) next = Math.round(next / 15) * 15;
        next = ((next + 540) % 360) - 180;
        updateActive({ angle: Math.round(next * 10) / 10 });
        syncInputsFromActive();
      });
    });
  }

  // Rectangle corner handles — drag corner to pointer, opposite corner stays fixed.
  // Updates width, height, and x/y (center moves).
  function wireCornerResize(handleEl, id, which) {
    handleEl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const o = state.objects.find((x) => x.id === id);
      if (!o || o.type !== "rect") return;
      if (state.activeId !== id) setActive(id);

      const canvasRect = canvas.getBoundingClientRect();
      const centerX = canvasRect.left + canvasRect.width / 2 + o.x;
      const centerY = canvasRect.top + canvasRect.height / 2 + o.y;
      const angRad = (o.angle * Math.PI) / 180;
      const xAxis = { x: Math.cos(angRad), y: Math.sin(angRad) };
      const yAxis = { x: -Math.sin(angRad), y: Math.cos(angRad) };
      const halfW = o.width / 2;
      const halfH = o.height / 2;

      // Which side of center each axis points toward, for this corner
      const xSign = which === "tr" || which === "br" ? 1 : -1;
      const ySign = which === "bl" || which === "br" ? 1 : -1;

      // Opposite corner (fixed during drag), in page coords
      const oppX = centerX - xSign * halfW * xAxis.x - ySign * halfH * yAxis.x;
      const oppY = centerY - xSign * halfW * xAxis.y - ySign * halfH * yAxis.y;

      handleEl.setPointerCapture(e.pointerId);

      attachDrag(handleEl, (ev) => {
        const dx = ev.clientX - oppX;
        const dy = ev.clientY - oppY;
        const projX = (dx * xAxis.x + dy * xAxis.y) * xSign;
        const projY = (dx * yAxis.x + dy * yAxis.y) * ySign;
        const newW = Math.max(1, projX);
        const newH = Math.max(1, projY);
        const newCx = oppX + xSign * (newW / 2) * xAxis.x + ySign * (newH / 2) * yAxis.x;
        const newCy = oppY + xSign * (newW / 2) * xAxis.y + ySign * (newH / 2) * yAxis.y;
        updateActive({
          width: Math.round(newW),
          height: Math.round(newH),
          x: Math.round(newCx - canvasRect.left - canvasRect.width / 2),
          y: Math.round(newCy - canvasRect.top - canvasRect.height / 2),
        });
        syncInputsFromActive();
      });
    });
  }

  // Rectangle edge handles — single-axis resize. Opposite edge center stays fixed.
  function wireEdgeResize(handleEl, id, which) {
    handleEl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const o = state.objects.find((x) => x.id === id);
      if (!o || o.type !== "rect") return;
      if (state.activeId !== id) setActive(id);

      const canvasRect = canvas.getBoundingClientRect();
      const centerX = canvasRect.left + canvasRect.width / 2 + o.x;
      const centerY = canvasRect.top + canvasRect.height / 2 + o.y;
      const angRad = (o.angle * Math.PI) / 180;
      const xAxis = { x: Math.cos(angRad), y: Math.sin(angRad) };
      const yAxis = { x: -Math.sin(angRad), y: Math.cos(angRad) };
      const halfW = o.width / 2;
      const halfH = o.height / 2;

      const xSign = which === "r" ? 1 : which === "l" ? -1 : 0;
      const ySign = which === "b" ? 1 : which === "t" ? -1 : 0;

      // Opposite edge center
      const oppX = centerX - xSign * halfW * xAxis.x - ySign * halfH * yAxis.x;
      const oppY = centerY - xSign * halfW * xAxis.y - ySign * halfH * yAxis.y;

      handleEl.setPointerCapture(e.pointerId);

      attachDrag(handleEl, (ev) => {
        const dx = ev.clientX - oppX;
        const dy = ev.clientY - oppY;
        if (xSign !== 0) {
          const proj = (dx * xAxis.x + dy * xAxis.y) * xSign;
          const newW = Math.max(1, proj);
          const newCx = oppX + xSign * (newW / 2) * xAxis.x;
          const newCy = oppY + xSign * (newW / 2) * xAxis.y;
          updateActive({
            width: Math.round(newW),
            x: Math.round(newCx - canvasRect.left - canvasRect.width / 2),
            y: Math.round(newCy - canvasRect.top - canvasRect.height / 2),
          });
        } else {
          const proj = (dx * yAxis.x + dy * yAxis.y) * ySign;
          const newH = Math.max(1, proj);
          const newCx = oppX + ySign * (newH / 2) * yAxis.x;
          const newCy = oppY + ySign * (newH / 2) * yAxis.y;
          updateActive({
            height: Math.round(newH),
            x: Math.round(newCx - canvasRect.left - canvasRect.width / 2),
            y: Math.round(newCy - canvasRect.top - canvasRect.height / 2),
          });
        }
        syncInputsFromActive();
      });
    });
  }

  // Circle cardinal handles — drag to resize diameter. Center stays fixed.
  function wireCircleResize(handleEl, id) {
    handleEl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const o = state.objects.find((x) => x.id === id);
      if (!o || o.type !== "circle") return;
      if (state.activeId !== id) setActive(id);

      const canvasRect = canvas.getBoundingClientRect();
      const centerX = canvasRect.left + canvasRect.width / 2 + o.x;
      const centerY = canvasRect.top + canvasRect.height / 2 + o.y;

      handleEl.setPointerCapture(e.pointerId);

      attachDrag(handleEl, (ev) => {
        const r = Math.max(1, Math.hypot(ev.clientX - centerX, ev.clientY - centerY));
        updateActive({ diameter: Math.round(r * 2) });
        syncInputsFromActive();
      });
    });
  }

  // Line endpoints — drag to relocate endpoint. Opposite endpoint stays fixed.
  // Naturally changes length, angle, and center.
  function wireLineEndHandle(handleEl, id, which) {
    handleEl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const o = state.objects.find((x) => x.id === id);
      if (!o || o.type !== "line") return;
      if (state.activeId !== id) setActive(id);

      const canvasRect = canvas.getBoundingClientRect();
      const centerX = canvasRect.left + canvasRect.width / 2 + o.x;
      const centerY = canvasRect.top + canvasRect.height / 2 + o.y;
      const angRad = (o.angle * Math.PI) / 180;
      const halfLen = o.length / 2;
      const dir = { x: Math.cos(angRad), y: Math.sin(angRad) };

      // Fixed endpoint (the other end)
      const fixedX = which === "start" ? centerX + halfLen * dir.x : centerX - halfLen * dir.x;
      const fixedY = which === "start" ? centerY + halfLen * dir.y : centerY - halfLen * dir.y;

      handleEl.setPointerCapture(e.pointerId);

      attachDrag(handleEl, (ev) => {
        const px = ev.clientX;
        const py = ev.clientY;
        const dx = px - fixedX;
        const dy = py - fixedY;
        const newLen = Math.max(1, Math.hypot(dx, dy));
        // angle points from start->end
        const rad = which === "end"
          ? Math.atan2(dy, dx)
          : Math.atan2(-dy, -dx);
        let newAngle = rad * (180 / Math.PI);
        if (ev.shiftKey) newAngle = Math.round(newAngle / 15) * 15;
        newAngle = Math.round(newAngle * 10) / 10;

        const newCx = (px + fixedX) / 2;
        const newCy = (py + fixedY) / 2;
        updateActive({
          length: Math.round(newLen),
          angle: newAngle,
          x: Math.round(newCx - canvasRect.left - canvasRect.width / 2),
          y: Math.round(newCy - canvasRect.top - canvasRect.height / 2),
        });
        syncInputsFromActive();
      });
    });
  }

  // Click empty canvas -> deselect (optional nicety)
  canvas.addEventListener("pointerdown", (e) => {
    if (e.target === canvas) {
      if (state.activeId !== null) {
        state.activeId = null;
        renderAll();
        syncInputsFromActive();
      }
    }
  });

  // Escape key deselects; Delete/Backspace removes active
  document.addEventListener("keydown", (e) => {
    // Don't hijack while typing in an input
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (e.key === "Escape" && state.activeId !== null) {
      state.activeId = null;
      renderAll();
      syncInputsFromActive();
    } else if ((e.key === "Delete" || e.key === "Backspace") && state.activeId !== null) {
      deleteObject(state.activeId);
    } else if (state.activeId !== null) {
      const step = e.shiftKey ? 10 : 1;
      const o = activeObj();
      if (!o) return;
      if (e.key === "ArrowLeft")      { updateActive({ x: o.x - step }); e.preventDefault(); }
      else if (e.key === "ArrowRight"){ updateActive({ x: o.x + step }); e.preventDefault(); }
      else if (e.key === "ArrowUp")   { updateActive({ y: o.y - step }); e.preventDefault(); }
      else if (e.key === "ArrowDown") { updateActive({ y: o.y + step }); e.preventDefault(); }
    }
  });

  // ---------- Canvas size readout ----------
  function updateCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    canvasSize.textContent = `Canvas: ${Math.round(rect.width)} \u00d7 ${Math.round(rect.height)} px`;
  }

  // ---------- Mode (CSS vs Physical) + Calibration ----------
  // (kept simple; calibration only changes the readout, not on-canvas rendering in this version,
  //  because with multiple objects a global scale multiplier would fight with drag coordinates.)
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
      modeHint.textContent = `Physical size \u2014 calibrated (${state.pxPerMm.toFixed(2)} px/mm). Readout shows mm/in.`;
    } else {
      modeHint.textContent = "Physical size \u2014 click Calibrate\u2026 to set the real-world scale.";
    }
    updateReadout();
  }

  modeCssBtn.addEventListener("click", () => setMode("css"));
  modePhysicalBtn.addEventListener("click", () => setMode("physical"));
  calibrateBtn.addEventListener("click", openCalibration);

  // Calibration modal
  let calCardWidthPx = 340;
  function cssPxPerMm() { return 96 / 25.4; }

  function openCalibration() {
    if (state.pxPerMm) calCardWidthPx = state.pxPerMm * CARD_WIDTH_MM;
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
  (function wireDrag() {
    let startX = 0, startW = 0, dragging = false;
    calHandle.addEventListener("pointerdown", (e) => {
      dragging = true; startX = e.clientX; startW = calCardWidthPx;
      calHandle.setPointerCapture?.(e.pointerId); e.preventDefault();
    });
    calHandle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      applyCalCardWidth(startW + (e.clientX - startX));
    });
    const up = (e) => { dragging = false; calHandle.releasePointerCapture?.(e.pointerId); };
    calHandle.addEventListener("pointerup", up);
    calHandle.addEventListener("pointercancel", up);
  })();
  calCancel.addEventListener("click", closeCalibration);
  calReset.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state.pxPerMm = null;
    applyCalCardWidth(CARD_WIDTH_MM * cssPxPerMm());
    setMode(state.mode);
  });
  calSave.addEventListener("click", () => {
    const pxPerMm = calCardWidthPx / CARD_WIDTH_MM;
    state.pxPerMm = pxPerMm;
    localStorage.setItem(STORAGE_KEY, String(pxPerMm));
    closeCalibration();
    setMode("physical");
  });
  calModal.addEventListener("click", (e) => {
    if (e.target === calModal) closeCalibration();
  });

  // ---------- Init ----------
  window.addEventListener("resize", updateCanvasSize);
  setMode("css");
  setActiveTab("line");

  const versionEl = $("version");
  if (versionEl) versionEl.textContent = `v${VERSION}`;

  // Seed with one line so the canvas isn't empty on first load
  createObject("line");
})();
