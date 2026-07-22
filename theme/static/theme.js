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
  const defaults = {
    transparency: 70,
    brightness: 94,
    sharpness: 100,
    motion: true,
    readingMode: true,
  };

  const readSettings = () => {
    try {
      return {
        ...defaults,
        ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
      };
    } catch {
      return { ...defaults };
    }
  };

  const settings = readSettings();
  let wallpaperObjectUrl = "";
  let wallpaperLoadPromise;
  let savedWallpaperRecord = null;
  let titlebarProbeScheduled = false;
  let titlebarObserver;
  let titlebarProbeTimer;
  let active = false;
  let activeRuntime = null;
  const wallpaperState = {
    name: "默认壁纸",
    error: false,
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

    if (!runtime?.wallpaper) {
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
    if (!/^[a-z0-9-]+\.(?:avif|jpe?g|png|webp)$/.test(runtime.wallpaper)) {
      throw new Error("Pro 壁纸文件无效");
    }
    if (!/^\d+% \d+%$/.test(runtime.wallpaperPosition ?? "")) {
      throw new Error("Pro 壁纸位置无效");
    }
    if (
      typeof runtime.wallpaperGradient !== "string"
      || !runtime.wallpaperGradient.includes("gradient(")
      || /url\(|;/i.test(runtime.wallpaperGradient)
    ) {
      throw new Error("Pro 壁纸渐变无效");
    }
    document.documentElement.style.setProperty(
      "--moonsea-wallpaper-image",
      `url("./wallpapers/${runtime.wallpaper}")`,
    );
    document.documentElement.style.setProperty(
      "--moonsea-wallpaper-position",
      runtime.wallpaperPosition,
    );
    document.documentElement.style.setProperty(
      "--moonsea-wallpaper-gradient",
      runtime.wallpaperGradient,
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
    const chromeAlpha = Math.min(0.86, mainAlpha + 0.16);
    root.style.setProperty("--moonsea-main-alpha", mainAlpha.toFixed(2));
    root.style.setProperty(
      "--moonsea-sidebar-alpha",
      chromeAlpha.toFixed(2),
    );
    root.style.setProperty(
      "--moonsea-titlebar-alpha",
      chromeAlpha.toFixed(2),
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
    root.classList.toggle("moonsea-motion-enabled", settings.motion);
    root.classList.toggle("moonsea-motion-disabled", !settings.motion);
    root.classList.toggle("moonsea-reading-enabled", settings.readingMode);
    root.classList.toggle("moonsea-reading-disabled", !settings.readingMode);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  };

  const refreshAssistantMode = () => {
    const controls = document.getElementById("codex-moonsea-controls");
    if (!controls) return;
    const proSettings = controls.querySelector("[data-pro-settings]");
    const standardNote = controls.querySelector("[data-standard-note]");
    const edition = controls.querySelector("[data-assistant-edition]");
    if (proSettings) proSettings.hidden = !active;
    if (standardNote) standardNote.hidden = active;
    if (edition) edition.textContent = active ? "Pro 主题" : "普通主题";
  };

  const createControls = () => {
    if (document.getElementById("codex-moonsea-controls")) return;

    const controls = document.createElement("div");
    controls.id = "codex-moonsea-controls";
    controls.innerHTML = `
      <section class="moonsea-controls__panel" aria-label="月海助手" hidden>
        <div class="moonsea-controls__title">
          月海助手
          <span data-assistant-edition>普通主题</span>
        </div>
        <div class="moonsea-assistant__update">
          <div class="moonsea-assistant__update-heading">
            <strong>软件更新</strong>
            <span class="moonsea-assistant__version" data-update-version>正在读取版本</span>
          </div>
          <p class="moonsea-assistant__message" data-update-message aria-live="polite">正在检查更新…</p>
          <div class="moonsea-assistant__progress" data-update-progress hidden aria-hidden="true"><span></span></div>
          <button class="moonsea-assistant__update-action" data-update-action type="button" hidden></button>
        </div>
        <p class="moonsea-assistant__standard-note" data-standard-note>当前使用 Codex 官方外观。切换 Pro 主题后，这里会出现壁纸与透明度设置。</p>
        <div data-pro-settings hidden>
          <div class="moonsea-assistant__pro-title">Pro 外观</div>
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
          <label class="moonsea-motion-row">
            <span>动态背景</span>
            <input data-setting="motion" type="checkbox">
            <span class="moonsea-motion-switch" aria-hidden="true"></span>
            <output data-output="motion"></output>
          </label>
          <label class="moonsea-motion-row">
            <span>正文增强</span>
            <input data-setting="readingMode" type="checkbox">
            <span class="moonsea-motion-switch" aria-hidden="true"></span>
            <output data-output="readingMode"></output>
          </label>
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
    `;

    const panel = controls.querySelector(".moonsea-controls__panel");
    const toggle = controls.querySelector(".moonsea-controls__toggle");
    const transparencyInput = controls.querySelector(
      '[data-setting="transparency"]',
    );
    const brightnessInput = controls.querySelector('[data-setting="brightness"]');
    const sharpnessInput = controls.querySelector('[data-setting="sharpness"]');
    const motionInput = controls.querySelector('[data-setting="motion"]');
    const readingModeInput = controls.querySelector(
      '[data-setting="readingMode"]',
    );
    const transparencyOutput = controls.querySelector(
      '[data-output="transparency"]',
    );
    const brightnessOutput = controls.querySelector('[data-output="brightness"]');
    const sharpnessOutput = controls.querySelector('[data-output="sharpness"]');
    const motionOutput = controls.querySelector('[data-output="motion"]');
    const readingModeOutput = controls.querySelector(
      '[data-output="readingMode"]',
    );
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
      updateMessage.classList.toggle("is-error", update.status === "error");
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
        updateMessage.textContent = "新版本已经准备好。月海版会关闭，并在更新后自动重新打开。";
        updateAction.textContent = "重新打开并更新";
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
      motionInput.checked = settings.motion;
      readingModeInput.checked = settings.readingMode;
      transparencyOutput.value = `${settings.transparency}%`;
      brightnessOutput.value = `${settings.brightness}%`;
      sharpnessOutput.value = `${settings.sharpness}%`;
      motionOutput.value = settings.motion ? "开启" : "关闭";
      readingModeOutput.value = settings.readingMode ? "开启" : "关闭";
    };

    toggle.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      toggle.setAttribute("aria-expanded", String(!panel.hidden));
    });

    updateAction.addEventListener("click", () => {
      updateAction.disabled = true;
      if (updateState?.status === "ready") {
        pendingUpdateCommand = "install";
        renderUpdate({ ...updateState, status: "installing" });
      } else {
        pendingUpdateCommand = "download";
        renderUpdate({ ...updateState, status: "checking", error: null });
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

    motionInput.addEventListener("change", () => {
      settings.motion = motionInput.checked;
      syncControls();
      applySettings();
    });

    readingModeInput.addEventListener("change", () => {
      settings.readingMode = readingModeInput.checked;
      syncControls();
      applySettings();
    });

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

  const createAmbientMotion = () => {
    if (document.getElementById("codex-moonsea-ambient")) return;

    const ambient = document.createElement("div");
    ambient.id = "codex-moonsea-ambient";
    ambient.setAttribute("aria-hidden", "true");
    ambient.innerHTML = `
      <span class="moonsea-ambient__dust moonsea-ambient__dust--near"></span>
      <span class="moonsea-ambient__dust moonsea-ambient__dust--far"></span>
      <span class="moonsea-ambient__glow moonsea-ambient__glow--blue"></span>
      <span class="moonsea-ambient__glow moonsea-ambient__glow--pearl"></span>
    `;
    document.body.appendChild(ambient);
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
      stylesheet.addEventListener("error", () => reject(new Error("Pro 主题样式加载失败")), { once: true });
      document.head.appendChild(stylesheet);
    });
  };

  const enable = async (runtime = null) => {
    if (!document.body) throw new Error("Codex 窗口还没有准备好");
    await ensureStylesheet();
    active = true;
    activeRuntime = runtime;
    document.documentElement.classList.add("codex-moonsea");
    applySettings();
    await loadSavedWallpaper();
    createAmbientMotion();
    createControls();
    refreshAssistantMode();
    scheduleTitlebarButtonProbe();
    return { active: true };
  };

  const disable = () => {
    active = false;
    const root = document.documentElement;
    root.classList.remove(
      "codex-moonsea",
      "moonsea-motion-enabled",
      "moonsea-motion-disabled",
      "moonsea-reading-enabled",
      "moonsea-reading-disabled",
    );
    for (const property of [
      "--moonsea-main-alpha",
      "--moonsea-sidebar-alpha",
      "--moonsea-titlebar-alpha",
      "--moonsea-control-alpha",
      "--moonsea-wallpaper-brightness",
      "--moonsea-wallpaper-blur",
      "--moonsea-wallpaper-image",
      "--moonsea-wallpaper-position",
      "--moonsea-wallpaper-gradient",
    ]) {
      root.style.removeProperty(property);
    }
    document.getElementById("codex-moonsea-ambient")?.remove();
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
    if (wallpaperObjectUrl) URL.revokeObjectURL(wallpaperObjectUrl);
  });
})();
