(() => {
  const autoEnable = document.currentScript?.dataset.autoEnable === "true";
  const initialRoute = new URLSearchParams(window.location.search).get("initialRoute");
  if (initialRoute === "/avatar-overlay") {
    return;
  }

  const STORAGE_KEY = "codex-moonsea-theme-settings-v2";
  const WALLPAPER_DB_NAME = "codex-moonsea-theme";
  const WALLPAPER_STORE_NAME = "assets";
  const WALLPAPER_KEY = "wallpaper";
  const MAX_WALLPAPER_SIZE = 40 * 1024 * 1024;
  const TITLEBAR_BUTTON_SELECTOR = [
    ".draggable button[aria-label]",
    '[class*="electron:h-toolbar"] button[aria-label]',
    "button.text-token-text-tertiary[aria-label]",
  ].join(",");
  const PALETTE_PROPERTIES = Object.freeze({
    ink: "--moonsea-ink",
    muted: "--moonsea-muted",
    faint: "--moonsea-faint",
    panel: "--moonsea-panel",
    panelStrong: "--moonsea-panel-strong",
    panelOpaque: "--moonsea-panel-opaque",
    sidebar: "--moonsea-sidebar",
    control: "--moonsea-control",
    hover: "--moonsea-hover",
    border: "--moonsea-border",
    borderLight: "--moonsea-border-light",
    borderHeavy: "--moonsea-border-heavy",
    accent: "--moonsea-accent",
    accentSoft: "--moonsea-accent-soft",
    accentHover: "--moonsea-accent-hover",
    accentActive: "--moonsea-accent-active",
    surfaceEdgeTint: "--moonsea-surface-edge-tint",
    elevationEdgeTint: "--moonsea-elevation-edge-tint",
    titlebarButtonInk: "--moonsea-titlebar-button-ink",
    titlebarButtonSurface: "--moonsea-titlebar-button-surface",
    titlebarButtonSurfaceHover: "--moonsea-titlebar-button-surface-hover",
    titlebarButtonSurfaceActive: "--moonsea-titlebar-button-surface-active",
    titlebarButtonBorder: "--moonsea-titlebar-button-border",
    readingSurface: "--moonsea-reading-surface",
    readingSurfaceStrong: "--moonsea-reading-surface-strong",
    readingDetail: "--moonsea-reading-detail",
    selection: "--moonsea-selection",
    toggleTrack: "--moonsea-toggle-track",
    highlight: "--moonsea-highlight",
    wallpaperVignette: "--moonsea-wallpaper-vignette",
    wallpaperProtection: "--moonsea-wallpaper-protection",
    wallpaperFloor: "--moonsea-wallpaper-floor",
    textShadow: "--moonsea-text-shadow",
    readingTextShadow: "--moonsea-reading-text-shadow",
    shadow: "--moonsea-shadow",
    shadowDeep: "--moonsea-shadow-deep",
  });
  const GRADIENT_PALETTE_KEYS = new Set([
    "wallpaperVignette",
    "wallpaperProtection",
    "wallpaperFloor",
  ]);
  const defaults = {
    transparency: 70,
    brightness: 94,
    sharpness: 100,
    readingMode: true,
    wallpaperSource: "theme",
    motionMode: "soft",
    clickRipple: true,
    motionOverrideReduced: false,
  };
  const WALLPAPER_SOURCES = new Set(["theme", "custom"]);
  const MOTION_MODES = new Set(["off", "soft", "lively"]);
  const MOTION_BLOCK_SELECTOR = [
    "#codex-moonsea-controls",
    "input",
    "textarea",
    "select",
    "button",
    "a",
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="dialog"]',
    '[role="menu"]',
    ".monaco-editor",
    ".xterm",
    '[class*="composer"]',
    '[class*="terminal"]',
    '[class*="markdown"]',
  ].join(",");
  const MOTION_PARAMETERS = Object.freeze({
    soft: Object.freeze({
      radius: 280,
      lightAlpha: 0.045,
      shiftX: 3,
      shiftY: 2,
      follow: 0.12,
    }),
    lively: Object.freeze({
      radius: 360,
      lightAlpha: 0.07,
      shiftX: 6,
      shiftY: 4,
      follow: 0.16,
    }),
  });

  const readSettings = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        transparency: saved.transparency ?? defaults.transparency,
        brightness: saved.brightness ?? defaults.brightness,
        sharpness: saved.sharpness ?? defaults.sharpness,
        readingMode: saved.readingMode ?? defaults.readingMode,
        wallpaperSource: WALLPAPER_SOURCES.has(saved.wallpaperSource)
          ? saved.wallpaperSource
          : defaults.wallpaperSource,
        motionMode: MOTION_MODES.has(saved.motionMode)
          ? saved.motionMode
          : defaults.motionMode,
        clickRipple: typeof saved.clickRipple === "boolean"
          ? saved.clickRipple
          : defaults.clickRipple,
        motionOverrideReduced: typeof saved.motionOverrideReduced === "boolean"
          ? saved.motionOverrideReduced
          : defaults.motionOverrideReduced,
      };
    } catch {
      return { ...defaults };
    }
  };

  const settings = readSettings();
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionDescription = () => {
    if (reducedMotionQuery.matches && !settings.motionOverrideReduced) {
      return "Windows 已关闭动画，月海已暂停特效；可开启“仍然播放”。";
    }
    if (reducedMotionQuery.matches && settings.motionOverrideReduced) {
      return "已按你的选择仅在月海播放，不会更改 Windows 设置。";
    }
    if (settings.motionMode === "lively") {
      return "包含光场、壁纸视差和受限区域外的拖动潮痕。";
    }
    if (settings.motionMode === "soft") {
      return "使用低强度光场和轻微壁纸视差。";
    }
    if (settings.clickRipple) {
      return "背景保持静止，仅保留点击月晕。";
    }
    return "所有交互特效均已关闭。";
  };
  const updateMotionDescription = () => {
    const note = document.querySelector("[data-motion-note]");
    if (note) note.textContent = motionDescription();
  };
  let wallpaperObjectUrl = "";
  let wallpaperLoadPromise;
  let savedWallpaperRecord = null;
  let titlebarProbeScheduled = false;
  let titlebarObserver;
  let titlebarProbeTimer;
  let active = false;
  let activeRuntime = null;
  let motionController;
  let runtimeGeneration = 0;
  const wallpaperState = {
    name: "默认壁纸",
    error: false,
  };

  const createAmbientMotion = () => {
    const layer = document.createElement("div");
    layer.id = "codex-moonsea-motion-layer";
    layer.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    canvas.className = "codex-moonsea-motion-canvas";
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("无法创建月海特效画布");
    layer.appendChild(canvas);

    const root = document.documentElement;
    const events = new AbortController();
    const ripples = [];
    const trails = [];
    const pointer = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      alpha: 0,
      targetAlpha: 0,
      downX: 0,
      downY: 0,
      previousX: 0,
      previousY: 0,
      dragging: false,
      dragBlocked: false,
    };
    let animationFrame = 0;
    let pixelRatio = 1;
    let currentMode = settings.motionMode;
    let clickRippleEnabled = settings.clickRipple;
    let overrideReducedMotion = settings.motionOverrideReduced;
    let hidden = document.hidden;
    let destroyed = false;
    let wallpaperX = 0;
    let wallpaperY = 0;
    let targetWallpaperX = 0;
    let targetWallpaperY = 0;
    let cachedAccent = getComputedStyle(root)
      .getPropertyValue("--moonsea-accent")
      .trim() || "oklch(82% 0.12 155)";
    const controlsRoot = document.getElementById("codex-moonsea-controls");
    if (!controlsRoot) throw new Error("月海助手尚未挂载");
    controlsRoot.prepend(layer);

    const effectiveMode = () =>
      !hidden
        && (!reducedMotionQuery.matches || overrideReducedMotion)
        && active
        && MOTION_MODES.has(currentMode)
        ? currentMode
        : "off";

    const accentColor = () => cachedAccent;

    const resetWallpaperOffset = () => {
      wallpaperX = 0;
      wallpaperY = 0;
      targetWallpaperX = 0;
      targetWallpaperY = 0;
      root.style.removeProperty("--moonsea-motion-x");
      root.style.removeProperty("--moonsea-motion-y");
    };

    const clearCanvas = () => {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };

    const drawLightField = (parameters) => {
      if (pointer.alpha <= 0.001) return;
      const gradient = context.createRadialGradient(
        pointer.x,
        pointer.y,
        0,
        pointer.x,
        pointer.y,
        parameters.radius,
      );
      gradient.addColorStop(0, accentColor());
      gradient.addColorStop(0.28, accentColor());
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.save();
      context.globalAlpha = parameters.lightAlpha * pointer.alpha;
      context.fillStyle = gradient;
      context.fillRect(
        pointer.x - parameters.radius,
        pointer.y - parameters.radius,
        parameters.radius * 2,
        parameters.radius * 2,
      );
      context.restore();
    };

    const drawRipples = (timestamp) => {
      const accent = accentColor();
      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        const progress = Math.max(
          0,
          Math.min(1, (timestamp - ripple.startedAt) / 380),
        );
        if (progress >= 1) {
          ripples.splice(index, 1);
          continue;
        }
        const eased = 1 - (1 - progress) ** 4;
        context.save();
        context.globalAlpha = (1 - progress) * 0.34;
        context.strokeStyle = accent;
        context.lineWidth = 1.25 + (1 - progress) * 0.75;
        context.beginPath();
        context.arc(ripple.x, ripple.y, 9 + eased * 58, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = (1 - progress) * 0.14;
        context.beginPath();
        context.arc(ripple.x, ripple.y, 4 + eased * 34, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }
    };

    const drawTrails = (timestamp) => {
      const accent = accentColor();
      for (let index = trails.length - 1; index >= 0; index -= 1) {
        const trail = trails[index];
        const progress = Math.max(
          0,
          Math.min(1, (timestamp - trail.startedAt) / 280),
        );
        if (progress >= 1) {
          trails.splice(index, 1);
          continue;
        }
        context.save();
        context.globalAlpha = (1 - progress) * 0.26;
        context.strokeStyle = accent;
        context.lineCap = "round";
        context.lineWidth = 1 + (1 - progress) * 1.8;
        context.beginPath();
        context.moveTo(trail.fromX, trail.fromY);
        context.quadraticCurveTo(
          (trail.fromX + trail.toX) / 2,
          (trail.fromY + trail.toY) / 2 - 4,
          trail.toX,
          trail.toY,
        );
        context.stroke();
        context.restore();
      }
    };

    const scheduleDraw = () => {
      if (destroyed || animationFrame) return;
      animationFrame = window.requestAnimationFrame(draw);
    };

    const draw = () => {
      animationFrame = 0;
      if (destroyed) return;
      const timestamp = performance.now();
      const mode = effectiveMode();
      const parameters = MOTION_PARAMETERS[mode];
      const follow = parameters?.follow ?? 0.18;
      pointer.x += (pointer.targetX - pointer.x) * follow;
      pointer.y += (pointer.targetY - pointer.y) * follow;
      pointer.alpha += (pointer.targetAlpha - pointer.alpha) * 0.14;
      wallpaperX += (targetWallpaperX - wallpaperX) * follow;
      wallpaperY += (targetWallpaperY - wallpaperY) * follow;

      if (mode !== "off") {
        root.style.setProperty("--moonsea-motion-x", `${wallpaperX.toFixed(2)}px`);
        root.style.setProperty("--moonsea-motion-y", `${wallpaperY.toFixed(2)}px`);
      }

      clearCanvas();
      if (parameters) drawLightField(parameters);
      drawRipples(timestamp);
      drawTrails(timestamp);

      const moving =
        Math.abs(pointer.targetX - pointer.x) > 0.2
        || Math.abs(pointer.targetY - pointer.y) > 0.2
        || Math.abs(pointer.targetAlpha - pointer.alpha) > 0.01
        || Math.abs(targetWallpaperX - wallpaperX) > 0.05
        || Math.abs(targetWallpaperY - wallpaperY) > 0.05;
      if (moving || ripples.length > 0 || trails.length > 0) scheduleDraw();
    };

    const resize = () => {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(window.innerWidth * pixelRatio));
      canvas.height = Math.max(1, Math.round(window.innerHeight * pixelRatio));
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      scheduleDraw();
    };

    const updateModeClasses = () => {
      const mode = effectiveMode();
      root.classList.toggle("moonsea-motion-soft", mode === "soft");
      root.classList.toggle("moonsea-motion-lively", mode === "lively");
      root.classList.toggle(
        "moonsea-motion-override-reduced",
        reducedMotionQuery.matches && overrideReducedMotion,
      );
      layer.hidden = (
        reducedMotionQuery.matches
        && !overrideReducedMotion
      ) || (!clickRippleEnabled && mode === "off");
      if (mode === "off") resetWallpaperOffset();
      if (layer.hidden) {
        ripples.length = 0;
        trails.length = 0;
        clearCanvas();
      } else {
        scheduleDraw();
      }
      updateMotionDescription();
    };

    const handlePointerMove = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      const mode = effectiveMode();
      const parameters = MOTION_PARAMETERS[mode];
      pointer.targetAlpha = parameters ? 1 : 0;
      if (parameters) {
        const normalizedX = event.clientX / Math.max(1, window.innerWidth) - 0.5;
        const normalizedY = event.clientY / Math.max(1, window.innerHeight) - 0.5;
        targetWallpaperX = -normalizedX * parameters.shiftX * 2;
        targetWallpaperY = -normalizedY * parameters.shiftY * 2;
      }

      if (pointer.dragging && !pointer.dragBlocked && mode === "lively") {
        if (!window.getSelection()?.isCollapsed) {
          pointer.dragBlocked = true;
        } else {
          const distance = Math.hypot(
            event.clientX - pointer.downX,
            event.clientY - pointer.downY,
          );
          const segment = Math.hypot(
            event.clientX - pointer.previousX,
            event.clientY - pointer.previousY,
          );
          if (distance >= 8 && segment >= 7) {
            trails.push({
              fromX: pointer.previousX,
              fromY: pointer.previousY,
              toX: event.clientX,
              toY: event.clientY,
              startedAt: performance.now(),
            });
            if (trails.length > 18) trails.splice(0, trails.length - 18);
            pointer.previousX = event.clientX;
            pointer.previousY = event.clientY;
          }
        }
      }
      scheduleDraw();
    };

    const handlePointerDown = (event) => {
      if (event.button !== 0 || (event.pointerType && event.pointerType !== "mouse")) return;
      pointer.downX = event.clientX;
      pointer.downY = event.clientY;
      pointer.previousX = event.clientX;
      pointer.previousY = event.clientY;
      pointer.dragging = true;
      pointer.dragBlocked = Boolean(event.target?.closest?.(MOTION_BLOCK_SELECTOR));
    };

    const handlePointerUp = () => {
      pointer.dragging = false;
      pointer.dragBlocked = false;
    };

    const handleClick = (event) => {
      if (
        event.detail <= 0
        || (reducedMotionQuery.matches && !overrideReducedMotion)
        || hidden
        || !active
        || !clickRippleEnabled
      ) {
        return;
      }
      ripples.push({
        x: event.clientX,
        y: event.clientY,
        startedAt: performance.now(),
      });
      if (ripples.length > 3) ripples.splice(0, ripples.length - 3);
      scheduleDraw();
    };

    const handlePointerLeave = () => {
      pointer.targetAlpha = 0;
      targetWallpaperX = 0;
      targetWallpaperY = 0;
      scheduleDraw();
    };

    const handleVisibility = () => {
      hidden = document.hidden;
      if (hidden) {
        pointer.targetAlpha = 0;
        ripples.length = 0;
        trails.length = 0;
      }
      updateModeClasses();
    };

    window.addEventListener("resize", resize, { signal: events.signal });
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
      signal: events.signal,
    });
    window.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
      signal: events.signal,
    });
    window.addEventListener("pointerup", handlePointerUp, {
      passive: true,
      signal: events.signal,
    });
    window.addEventListener("pointercancel", handlePointerUp, {
      passive: true,
      signal: events.signal,
    });
    document.documentElement.addEventListener("mouseleave", handlePointerLeave, {
      passive: true,
      signal: events.signal,
    });
    document.addEventListener("click", handleClick, {
      passive: true,
      signal: events.signal,
    });
    document.addEventListener("visibilitychange", handleVisibility, {
      signal: events.signal,
    });
    reducedMotionQuery.addEventListener("change", updateModeClasses, {
      signal: events.signal,
    });

    resize();
    updateModeClasses();

    return Object.freeze({
      destroy: () => {
        destroyed = true;
        events.abort();
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        root.classList.remove(
          "moonsea-motion-soft",
          "moonsea-motion-lively",
          "moonsea-motion-override-reduced",
        );
        resetWallpaperOffset();
        layer.remove();
      },
      sync: (nextSettings) => {
        currentMode = MOTION_MODES.has(nextSettings.motionMode)
          ? nextSettings.motionMode
          : defaults.motionMode;
        clickRippleEnabled = Boolean(nextSettings.clickRipple);
        overrideReducedMotion = Boolean(nextSettings.motionOverrideReduced);
        cachedAccent = getComputedStyle(root)
          .getPropertyValue("--moonsea-accent")
          .trim() || "oklch(82% 0.12 155)";
        updateModeClasses();
      },
    });
  };

  const applyRuntimePalette = (runtime) => {
    const root = document.documentElement;
    for (const property of Object.values(PALETTE_PROPERTIES)) {
      root.style.removeProperty(property);
    }
    root.style.removeProperty("color-scheme");

    if (!runtime?.palette) return;
    if (!["light", "dark"].includes(runtime.palette.scheme)) {
      throw new Error("月海壁纸配色模式无效");
    }
    for (const [key, property] of Object.entries(PALETTE_PROPERTIES)) {
      const value = runtime.palette[key];
      if (
        typeof value !== "string"
        || !value.trim()
        || /[;{}]|url\(/i.test(value)
        || (GRADIENT_PALETTE_KEYS.has(key) && !value.includes("gradient("))
      ) {
        throw new Error(`月海壁纸配色 ${key} 无效`);
      }
      root.style.setProperty(property, value);
    }
    root.style.colorScheme = runtime.palette.scheme;
  };

  const updateWallpaperStatus = () => {
    const output = document.querySelector("[data-wallpaper-status]");
    if (!output) return;
    output.value = wallpaperState.name;
    output.title = wallpaperState.name;
    output.classList.toggle("is-error", wallpaperState.error);
  };

  const openWallpaperDatabase = () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(WALLPAPER_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(WALLPAPER_STORE_NAME)) {
          database.createObjectStore(WALLPAPER_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const readSavedWallpaper = async () => {
    const database = await openWallpaperDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const request = database
          .transaction(WALLPAPER_STORE_NAME, "readonly")
          .objectStore(WALLPAPER_STORE_NAME)
          .get(WALLPAPER_KEY);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  };

  const writeSavedWallpaper = async (record) => {
    const database = await openWallpaperDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(
          WALLPAPER_STORE_NAME,
          "readwrite",
        );
        transaction.objectStore(WALLPAPER_STORE_NAME).put(record, WALLPAPER_KEY);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  };

  const removeSavedWallpaper = async () => {
    const database = await openWallpaperDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(
          WALLPAPER_STORE_NAME,
          "readwrite",
        );
        transaction.objectStore(WALLPAPER_STORE_NAME).delete(WALLPAPER_KEY);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  };

  const applyPackagedWallpaper = (runtime) => {
    if (wallpaperObjectUrl) {
      URL.revokeObjectURL(wallpaperObjectUrl);
      wallpaperObjectUrl = "";
    }

    if (!runtime?.wallpaper && !runtime?.backgroundGradient) {
      for (const property of [
        "--moonsea-wallpaper-image",
        "--moonsea-wallpaper-position",
        "--moonsea-wallpaper-gradient",
      ]) {
        document.documentElement.style.removeProperty(property);
      }
      wallpaperState.name = "默认壁纸";
      wallpaperState.error = false;
      updateWallpaperStatus();
      return;
    }
    if (!/^\d+% \d+%$/.test(runtime.wallpaperPosition ?? "")) {
      throw new Error("壁纸位置无效");
    }
    if (runtime.wallpaper) {
      if (!/^[a-z0-9-]+\.(?:avif|jpe?g|png|webp)$/.test(runtime.wallpaper)) {
        throw new Error("壁纸文件无效");
      }
      if (
        typeof runtime.wallpaperGradient !== "string"
        || !runtime.wallpaperGradient.includes("gradient(")
        || /url\(|;/i.test(runtime.wallpaperGradient)
      ) {
        throw new Error("壁纸遮罩无效");
      }
      document.documentElement.style.setProperty(
        "--moonsea-wallpaper-image",
        `url("app://-/moonsea/wallpapers/${runtime.wallpaper}")`,
      );
      document.documentElement.style.setProperty(
        "--moonsea-wallpaper-gradient",
        runtime.wallpaperGradient,
      );
    } else {
      if (
        typeof runtime.backgroundGradient !== "string"
        || !runtime.backgroundGradient.includes("gradient(")
        || /url\(|;/i.test(runtime.backgroundGradient)
      ) {
        throw new Error("渐变壁纸无效");
      }
      document.documentElement.style.setProperty(
        "--moonsea-wallpaper-image",
        runtime.backgroundGradient,
      );
      document.documentElement.style.setProperty(
        "--moonsea-wallpaper-gradient",
        "linear-gradient(transparent, transparent)",
      );
    }
    document.documentElement.style.setProperty(
      "--moonsea-wallpaper-position",
      runtime.wallpaperPosition,
    );
    wallpaperState.name = runtime.wallpaperName || "月海壁纸";
    wallpaperState.error = false;
    updateWallpaperStatus();
  };

  const applyWallpaper = (record) => {
    if (wallpaperObjectUrl) {
      URL.revokeObjectURL(wallpaperObjectUrl);
      wallpaperObjectUrl = "";
    }

    if (record?.blob instanceof Blob) {
      wallpaperObjectUrl = URL.createObjectURL(record.blob);
      document.documentElement.style.setProperty(
        "--moonsea-wallpaper-image",
        `url("${wallpaperObjectUrl}")`,
      );
      wallpaperState.name = record.name || "自定义壁纸";
    } else {
      applyPackagedWallpaper(activeRuntime);
      return;
    }
    wallpaperState.error = false;
    updateWallpaperStatus();
  };

  const loadSavedWallpaper = async () => {
    if (!wallpaperLoadPromise) {
      wallpaperLoadPromise = readSavedWallpaper()
        .then((record) => {
          savedWallpaperRecord = record;
          return record;
        });
    }
    try {
      await wallpaperLoadPromise;
      applyWallpaper(savedWallpaperRecord);
    } catch {
      wallpaperState.name = "壁纸读取失败";
      wallpaperState.error = true;
      updateWallpaperStatus();
    }
  };

  const validateWallpaper = async (file) => {
    if (!file?.type.startsWith("image/")) {
      throw new Error("请选择图片文件");
    }
    if (file.size > MAX_WALLPAPER_SIZE) {
      throw new Error("图片不能超过 40 MB");
    }

    const previewUrl = URL.createObjectURL(file);
    try {
      await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = () => reject(new Error("图片无法读取"));
        image.src = previewUrl;
      });
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const applySettings = () => {
    const root = document.documentElement;
    const mainAlpha = Math.max(
      0.12,
      Math.min(0.78, 1 - settings.transparency / 100),
    );
    const sidebarAlpha = Math.min(0.86, mainAlpha + 0.16);
    root.style.setProperty("--moonsea-main-alpha", mainAlpha.toFixed(2));
    root.style.setProperty(
      "--moonsea-sidebar-alpha",
      sidebarAlpha.toFixed(2),
    );
    root.style.setProperty(
      "--moonsea-control-alpha",
      Math.min(0.96, mainAlpha + 0.50).toFixed(2),
    );
    root.style.setProperty(
      "--moonsea-wallpaper-brightness",
      (settings.brightness / 100).toFixed(2),
    );
    root.style.setProperty(
      "--moonsea-wallpaper-blur",
      `${Math.max(0, Math.min(4, (100 - settings.sharpness) / 20)).toFixed(2)}px`,
    );
    root.classList.toggle("moonsea-reading-enabled", settings.readingMode);
    root.classList.toggle("moonsea-reading-disabled", !settings.readingMode);
    motionController?.sync(settings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  };

  const refreshAssistantMode = () => {
    const controls = document.getElementById("codex-moonsea-controls");
    if (!controls) return;
    const wallpaperSettings = controls.querySelector("[data-wallpaper-settings]");
    const inactiveNote = controls.querySelector("[data-inactive-note]");
    const edition = controls.querySelector("[data-assistant-edition]");
    if (wallpaperSettings) wallpaperSettings.hidden = !active;
    if (inactiveNote) inactiveNote.hidden = active;
    if (edition) {
      edition.textContent = active
        ? activeRuntime?.tier === "pro" ? "Pro 壁纸" : "渐变壁纸"
        : "壁纸未启用";
    }
  };

  const createControls = () => {
    if (document.getElementById("codex-moonsea-controls")) return;

    const controls = document.createElement("div");
    controls.id = "codex-moonsea-controls";
    controls.innerHTML = `
      <div class="moonsea-controls__dock">
        <section class="moonsea-controls__panel" aria-label="月海助手" hidden>
        <div class="moonsea-controls__title">
          月海助手
          <span data-assistant-edition>壁纸未启用</span>
        </div>
        <div class="moonsea-assistant__update" title="双击立即检查更新">
          <div class="moonsea-assistant__update-heading">
            <strong>软件更新</strong>
            <span class="moonsea-assistant__version" data-update-version>正在读取版本</span>
          </div>
          <p class="moonsea-assistant__message" data-update-message aria-live="polite">正在检查更新…</p>
          <div class="moonsea-assistant__progress" data-update-progress hidden aria-hidden="true"><span></span></div>
          <button class="moonsea-assistant__update-action" data-update-action type="button" hidden></button>
        </div>
        <p class="moonsea-assistant__standard-note" data-inactive-note>当前未启用月海壁纸。应用任意渐变或 Pro 壁纸后，可在这里继续调整。</p>
        <div data-wallpaper-settings hidden>
          <div class="moonsea-assistant__pro-title">壁纸外观</div>
          <label class="moonsea-control-row">
            <span>界面透明度</span>
            <input data-setting="transparency" type="range" min="22" max="88" step="1">
            <output data-output="transparency"></output>
          </label>
          <label class="moonsea-control-row">
            <span>背景亮度</span>
            <input data-setting="brightness" type="range" min="55" max="115" step="1">
            <output data-output="brightness"></output>
          </label>
          <label class="moonsea-control-row">
            <span>背景清晰度</span>
            <input data-setting="sharpness" type="range" min="20" max="100" step="1">
            <output data-output="sharpness"></output>
          </label>
          <label class="moonsea-toggle-row">
            <span>正文增强</span>
            <input data-setting="readingMode" type="checkbox">
            <span class="moonsea-toggle-switch" aria-hidden="true"></span>
            <output data-output="readingMode"></output>
          </label>
          <div class="moonsea-motion-settings">
            <div class="moonsea-motion-settings__title">交互特效</div>
            <label class="moonsea-select-row">
              <span>背景响应</span>
              <select data-setting="motionMode">
                <option value="off">关闭</option>
                <option value="soft">轻柔</option>
                <option value="lively">灵动</option>
              </select>
            </label>
            <label class="moonsea-toggle-row">
              <span>点击月晕</span>
              <input data-setting="clickRipple" type="checkbox">
              <span class="moonsea-toggle-switch" aria-hidden="true"></span>
              <output data-output="clickRipple"></output>
            </label>
            <label class="moonsea-toggle-row moonsea-reduced-motion-row" data-reduced-motion-control hidden>
              <span>仍然播放</span>
              <input data-setting="motionOverrideReduced" type="checkbox">
              <span class="moonsea-toggle-switch" aria-hidden="true"></span>
              <output data-output="motionOverrideReduced"></output>
            </label>
            <p class="moonsea-motion-settings__note" data-motion-note aria-live="polite"></p>
          </div>
          <div class="moonsea-wallpaper-row">
            <input data-wallpaper-input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif">
            <button class="moonsea-wallpaper-select" type="button">更换壁纸</button>
            <output data-wallpaper-status aria-live="polite"></output>
          </div>
          <div class="moonsea-controls__actions">
            <button class="moonsea-controls__reset" type="button">恢复默认</button>
          </div>
        </div>
        </section>
        <button class="moonsea-controls__toggle" type="button" title="打开月海助手" aria-label="打开月海助手" aria-expanded="false">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"/><path d="M17.5 5.5h.01"/></svg>
          <span>月海助手</span>
        </button>
      </div>
    `;

    const panel = controls.querySelector(".moonsea-controls__panel");
    const toggle = controls.querySelector(".moonsea-controls__toggle");
    const updateSection = controls.querySelector(".moonsea-assistant__update");
    const transparencyInput = controls.querySelector(
      '[data-setting="transparency"]',
    );
    const brightnessInput = controls.querySelector('[data-setting="brightness"]');
    const sharpnessInput = controls.querySelector('[data-setting="sharpness"]');
    const readingModeInput = controls.querySelector(
      '[data-setting="readingMode"]',
    );
    const motionModeInput = controls.querySelector(
      '[data-setting="motionMode"]',
    );
    const clickRippleInput = controls.querySelector(
      '[data-setting="clickRipple"]',
    );
    const motionOverrideReducedInput = controls.querySelector(
      '[data-setting="motionOverrideReduced"]',
    );
    const reducedMotionControl = controls.querySelector(
      "[data-reduced-motion-control]",
    );
    const transparencyOutput = controls.querySelector(
      '[data-output="transparency"]',
    );
    const brightnessOutput = controls.querySelector('[data-output="brightness"]');
    const sharpnessOutput = controls.querySelector('[data-output="sharpness"]');
    const readingModeOutput = controls.querySelector(
      '[data-output="readingMode"]',
    );
    const clickRippleOutput = controls.querySelector(
      '[data-output="clickRipple"]',
    );
    const motionOverrideReducedOutput = controls.querySelector(
      '[data-output="motionOverrideReduced"]',
    );
    const motionNote = controls.querySelector("[data-motion-note]");
    const wallpaperInput = controls.querySelector("[data-wallpaper-input]");
    const wallpaperSelect = controls.querySelector(".moonsea-wallpaper-select");
    const updateVersion = controls.querySelector("[data-update-version]");
    const updateMessage = controls.querySelector("[data-update-message]");
    const updateProgress = controls.querySelector("[data-update-progress]");
    const updateAction = controls.querySelector("[data-update-action]");
    let updateState = null;
    let pendingUpdateCommand = null;

    const renderUpdate = (update) => {
      updateState = update;
      updateVersion.textContent = update.currentVersion ? `v${update.currentVersion}` : "版本未知";
      updateMessage.classList.toggle("is-error", update.status === "error" || Boolean(update.error));
      updateProgress.hidden = update.status !== "downloading";
      updateProgress.style.setProperty("--moonsea-update-progress", String((update.progress || 0) / 100));
      toggle.classList.toggle("is-update-available", ["available", "ready"].includes(update.status));
      updateAction.hidden = false;
      updateAction.disabled = false;
      if (update.status === "checking") {
        updateMessage.textContent = "正在检查更新…";
        updateAction.hidden = true;
      } else if (update.status === "current") {
        updateMessage.textContent = "已经是最新版本。";
        updateAction.hidden = true;
      } else if (update.status === "available") {
        updateMessage.textContent = `发现 v${update.latestVersion}。${update.notes || ""}`.trim();
        updateAction.textContent = "立即更新";
      } else if (update.status === "downloading") {
        updateMessage.textContent = `正在下载更新… ${update.progress || 0}%`;
        updateAction.textContent = "正在下载";
        updateAction.disabled = true;
      } else if (update.status === "ready") {
        updateMessage.textContent = update.error
          || "新版本已经准备好。月海版会关闭，并在更新后自动重新打开。";
        updateAction.textContent = update.error ? "重试安装" : "重新打开并更新";
      } else if (update.status === "starting") {
        updateMessage.textContent = "正在启动更新程序，确认安全接管后会自动重启…";
        updateAction.textContent = "正在准备";
        updateAction.disabled = true;
      } else if (update.status === "installing") {
        updateMessage.textContent = "正在切换到新版本…";
        updateAction.textContent = "正在更新";
        updateAction.disabled = true;
      } else {
        updateMessage.textContent = update.error || "暂时无法检查更新。";
        updateAction.textContent = "重试";
      }
    };

    const syncControls = () => {
      transparencyInput.value = String(settings.transparency);
      brightnessInput.value = String(settings.brightness);
      sharpnessInput.value = String(settings.sharpness);
      readingModeInput.checked = settings.readingMode;
      motionModeInput.value = settings.motionMode;
      clickRippleInput.checked = settings.clickRipple;
      motionOverrideReducedInput.checked = settings.motionOverrideReduced;
      reducedMotionControl.hidden = !reducedMotionQuery.matches;
      transparencyOutput.value = `${settings.transparency}%`;
      brightnessOutput.value = `${settings.brightness}%`;
      sharpnessOutput.value = `${settings.sharpness}%`;
      readingModeOutput.value = settings.readingMode ? "开启" : "关闭";
      clickRippleOutput.value = settings.clickRipple ? "开启" : "关闭";
      motionOverrideReducedOutput.value = settings.motionOverrideReduced
        ? "开启"
        : "关闭";
      motionNote.textContent = motionDescription();
    };

    toggle.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      toggle.setAttribute("aria-expanded", String(!panel.hidden));
    });

    updateSection.addEventListener("dblclick", () => {
      if (["checking", "downloading", "ready", "starting", "installing"].includes(updateState?.status)) {
        return;
      }
      pendingUpdateCommand = "check";
      renderUpdate({
        ...(updateState ?? {}),
        status: "checking",
        error: null,
      });
    });

    updateAction.addEventListener("click", () => {
      updateAction.disabled = true;
      if (updateState?.status === "ready") {
        pendingUpdateCommand = "install";
        renderUpdate({ ...updateState, status: "starting", error: null });
      } else {
        pendingUpdateCommand = "download";
        renderUpdate({ ...updateState, status: "downloading", progress: updateState?.progress || 0, error: null });
      }
    });

    transparencyInput.addEventListener("input", () => {
      settings.transparency = Number(transparencyInput.value);
      syncControls();
      applySettings();
    });

    brightnessInput.addEventListener("input", () => {
      settings.brightness = Number(brightnessInput.value);
      syncControls();
      applySettings();
    });

    sharpnessInput.addEventListener("input", () => {
      settings.sharpness = Number(sharpnessInput.value);
      syncControls();
      applySettings();
    });

    readingModeInput.addEventListener("change", () => {
      settings.readingMode = readingModeInput.checked;
      syncControls();
      applySettings();
    });

    motionModeInput.addEventListener("change", () => {
      settings.motionMode = MOTION_MODES.has(motionModeInput.value)
        ? motionModeInput.value
        : defaults.motionMode;
      applySettings();
      syncControls();
    });

    clickRippleInput.addEventListener("change", () => {
      settings.clickRipple = clickRippleInput.checked;
      applySettings();
      syncControls();
    });

    motionOverrideReducedInput.addEventListener("change", () => {
      settings.motionOverrideReduced = motionOverrideReducedInput.checked;
      applySettings();
      syncControls();
    });

    reducedMotionQuery.addEventListener("change", syncControls);

    wallpaperSelect.addEventListener("click", () => wallpaperInput.click());

    wallpaperInput.addEventListener("change", async () => {
      const file = wallpaperInput.files?.[0];
      wallpaperInput.value = "";
      if (!file) return;

      wallpaperSelect.disabled = true;
      wallpaperState.name = "正在保存…";
      wallpaperState.error = false;
      updateWallpaperStatus();

      try {
        await validateWallpaper(file);
        const record = {
          blob: file.slice(0, file.size, file.type),
          name: file.name,
          type: file.type,
          size: file.size,
          updatedAt: Date.now(),
        };
        await writeSavedWallpaper(record);
        savedWallpaperRecord = record;
        wallpaperLoadPromise = Promise.resolve(record);
        settings.wallpaperSource = "custom";
        applySettings();
        applyWallpaper(record);
      } catch (error) {
        wallpaperState.name = error?.message || "壁纸更换失败";
        wallpaperState.error = true;
        updateWallpaperStatus();
      } finally {
        wallpaperSelect.disabled = false;
      }
    });

    controls
      .querySelector(".moonsea-controls__reset")
      .addEventListener("click", async () => {
        Object.assign(settings, defaults);
        syncControls();
        applySettings();
        try {
          await removeSavedWallpaper();
          savedWallpaperRecord = null;
          wallpaperLoadPromise = Promise.resolve(null);
          applyWallpaper(null);
        } catch {
          wallpaperState.name = "恢复壁纸失败";
          wallpaperState.error = true;
          updateWallpaperStatus();
        }
      });

    syncControls();
    document.body.appendChild(controls);
    updateWallpaperStatus();
    refreshAssistantMode();
    Object.defineProperty(window, "moonseaAssistantUpdateBridge", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({
        setStatus: (update) => renderUpdate(update),
        takeCommand: () => {
          const command = pendingUpdateCommand;
          pendingUpdateCommand = null;
          return command;
        },
      }),
    });
  };

  const reportTitlebarButtonStyles = () => {
    const buttons = [...document.querySelectorAll(TITLEBAR_BUTTON_SELECTOR)];
    if (buttons.length === 0) return false;

    const styles = buttons.slice(0, 6).map((button, index) => {
      const icon = button.querySelector("svg");
      const buttonStyle = getComputedStyle(button);
      const iconStyle = icon ? getComputedStyle(icon) : null;
      const bounds = button.getBoundingClientRect();
      return {
        index,
        color: buttonStyle.color,
        backgroundColor: buttonStyle.backgroundColor,
        borderColor: buttonStyle.borderColor,
        iconColor: iconStyle?.color ?? null,
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    });

    console.info(
      `[codex-moonsea] titlebar-button-styles ${JSON.stringify(styles)}`,
    );
    return true;
  };

  const scheduleTitlebarButtonProbe = () => {
    if (titlebarProbeScheduled) return;
    titlebarProbeScheduled = true;
    if (reportTitlebarButtonStyles()) return;

    titlebarObserver = new MutationObserver(() => {
      if (reportTitlebarButtonStyles()) titlebarObserver?.disconnect();
    });
    titlebarObserver.observe(document.documentElement, { childList: true, subtree: true });
    titlebarProbeTimer = window.setTimeout(() => titlebarObserver?.disconnect(), 15_000);
  };

  const ensureStylesheet = () => {
    const existing = document.getElementById("codex-moonsea-static-theme");
    if (existing?.sheet) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const stylesheet = existing ?? document.createElement("link");
      stylesheet.id = "codex-moonsea-static-theme";
      stylesheet.rel = "stylesheet";
      stylesheet.href = "./moonsea/theme.css";
      stylesheet.addEventListener("load", () => resolve(stylesheet), { once: true });
      stylesheet.addEventListener("error", () => reject(new Error("月海壁纸样式加载失败")), { once: true });
      document.head.appendChild(stylesheet);
    });
  };

  const enable = async (runtime = null, options = {}) => {
    if (!document.body) throw new Error("Codex 窗口还没有准备好");
    const generation = ++runtimeGeneration;
    await ensureStylesheet();
    active = true;
    activeRuntime = runtime;
    if (options.selectTheme === true) settings.wallpaperSource = "theme";
    document.documentElement.classList.add("codex-moonsea");
    applyRuntimePalette(runtime);
    applySettings();
    if (settings.wallpaperSource === "custom") {
      await loadSavedWallpaper();
    } else {
      applyPackagedWallpaper(runtime);
    }
    if (generation !== runtimeGeneration || !active) return { active };
    createControls();
    motionController?.destroy();
    motionController = createAmbientMotion();
    motionController.sync(settings);
    refreshAssistantMode();
    scheduleTitlebarButtonProbe();
    return { active: true };
  };

  const disable = () => {
    runtimeGeneration += 1;
    active = false;
    const root = document.documentElement;
    root.classList.remove(
      "codex-moonsea",
      "moonsea-reading-enabled",
      "moonsea-reading-disabled",
    );
    motionController?.destroy();
    motionController = undefined;
    for (const property of [
      "--moonsea-main-alpha",
      "--moonsea-sidebar-alpha",
      "--moonsea-control-alpha",
      "--moonsea-wallpaper-brightness",
      "--moonsea-wallpaper-blur",
      "--moonsea-wallpaper-image",
      "--moonsea-wallpaper-position",
      "--moonsea-wallpaper-gradient",
    ]) {
      root.style.removeProperty(property);
    }
    applyRuntimePalette(null);
    document.getElementById("codex-moonsea-static-theme")?.remove();
    titlebarObserver?.disconnect();
    titlebarObserver = undefined;
    if (titlebarProbeTimer) window.clearTimeout(titlebarProbeTimer);
    titlebarProbeTimer = undefined;
    titlebarProbeScheduled = false;
    if (wallpaperObjectUrl) URL.revokeObjectURL(wallpaperObjectUrl);
    wallpaperObjectUrl = "";
    wallpaperLoadPromise = undefined;
    savedWallpaperRecord = null;
    activeRuntime = null;
    refreshAssistantMode();
    return { active: false };
  };

  Object.defineProperty(window, "moonseaProRuntime", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ disable, enable, isActive: () => active }),
  });
  createControls();
  if (autoEnable) void enable();
  window.addEventListener("beforeunload", () => {
    motionController?.destroy();
    if (wallpaperObjectUrl) URL.revokeObjectURL(wallpaperObjectUrl);
  });
})();
