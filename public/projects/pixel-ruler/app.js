(() => {
  "use strict";

  // ---------- Constants ----------
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
    const count = state.objects.filter((o) => o.type === type).length;
    // Spawn offset so objects don't stack at center
    const offset = state.objects.length * 30;
    const base = { id, type, x: offset, y: offset, angle: 0 };

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
    const isActive = o.id === state.activeId;
    root.dataset.active = isActive ? "true" : "false";

    // Size
    let w, h;
    if (o.type === "line") {
      w = o.length;
      h = o.thickness;
      root.dataset.thin = o.thickness <= 2 ? "true" : "false";
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

    // Keep label text up to date when active
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

    // Handles
    const wanted = o.type === "line" ? ["start", "end"] : o.type === "rect" ? ["tl", "tr", "bl", "br"] : [];
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
        wireHandlePointer(h, o.id);
        root.appendChild(h);
        entry.handles[pos] = h;
      }
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
    li.innerHTML = `
      <span class="ico" aria-hidden="true">${iconFor(o.type)}</span>
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
    li.addEventListener("click", (e) => {
      if (e.target.closest(".trash")) return;
      setActive(o.id);
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

    // Index in list
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

  function iconFor(type) {
    if (type === "line") {
      return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 8h12"/></svg>`;
    }
    if (type === "rect") {
      return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="4" width="12" height="8" rx="1"/></svg>`;
    }
    return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="5.4"/></svg>`;
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

  // ---------- Canvas interactions ----------
  function wireShapePointer(root, id) {
    root.addEventListener("pointerdown", (e) => {
      // Handles handle their own pointerdown via stopPropagation
      if (e.target.classList.contains("handle")) return;
      // Select it
      if (state.activeId !== id) setActive(id);
      // Only drag if this IS the active shape (prevents drag-on-first-click that also selects)
      if (state.activeId !== id) return;

      e.preventDefault();
      const o = state.objects.find((x) => x.id === id);
      if (!o) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const ox = o.x;
      const oy = o.y;
      root.setPointerCapture(e.pointerId);

      const move = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        updateActive({ x: ox + dx, y: oy + dy });
      };
      const up = (ev) => {
        root.releasePointerCapture?.(ev.pointerId);
        root.removeEventListener("pointermove", move);
        root.removeEventListener("pointerup", up);
        root.removeEventListener("pointercancel", up);
      };
      root.addEventListener("pointermove", move);
      root.addEventListener("pointerup", up);
      root.addEventListener("pointercancel", up);
    });
  }

  function wireHandlePointer(handleEl, id) {
    handleEl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const o = state.objects.find((x) => x.id === id);
      if (!o) return;
      if (state.activeId !== id) setActive(id);

      // For lines/rects: rotate by computing angle from shape center to pointer
      const rect = domById.get(id).root.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Anchor angle: current pointer angle minus current object angle
      const initialPointerAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
      const anchorOffset = initialPointerAngle - o.angle;

      handleEl.setPointerCapture(e.pointerId);

      const move = (ev) => {
        const ang = Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI);
        let next = ang - anchorOffset;
        // Snap to 15deg with Shift
        if (ev.shiftKey) next = Math.round(next / 15) * 15;
        // Normalize to [-180, 180]
        next = ((next + 540) % 360) - 180;
        updateActive({ angle: Math.round(next * 10) / 10 });
        syncInputsFromActive();
      };
      const up = (ev) => {
        handleEl.releasePointerCapture?.(ev.pointerId);
        handleEl.removeEventListener("pointermove", move);
        handleEl.removeEventListener("pointerup", up);
        handleEl.removeEventListener("pointercancel", up);
      };
      handleEl.addEventListener("pointermove", move);
      handleEl.addEventListener("pointerup", up);
      handleEl.addEventListener("pointercancel", up);
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

  // Seed with one line so the canvas isn't empty on first load
  createObject("line");
})();
