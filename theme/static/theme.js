(() => {
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
  let titlebarProbeScheduled = false;
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
      document.documentElement.style.removeProperty(
        "--moonsea-wallpaper-image",
      );
      wallpaperState.name = "默认壁纸";
    }
    wallpaperState.error = false;
    updateWallpaperStatus();
  };

  const loadSavedWallpaper = () => {
    if (!wallpaperLoadPromise) {
      wallpaperLoadPromise = readSavedWallpaper()
        .then(applyWallpaper)
        .catch(() => {
          wallpaperState.name = "壁纸读取失败";
          wallpaperState.error = true;
          updateWallpaperStatus();
        });
    }
    return wallpaperLoadPromise;
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
    root.style.setProperty("--moonsea-main-alpha", mainAlpha.toFixed(2));
    root.style.setProperty(
      "--moonsea-sidebar-alpha",
      Math.min(0.86, mainAlpha + 0.16).toFixed(2),
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

  const createControls = () => {
    if (document.getElementById("codex-moonsea-controls")) return;

    const controls = document.createElement("div");
    controls.id = "codex-moonsea-controls";
    controls.innerHTML = `
      <section class="moonsea-controls__panel" hidden>
        <div class="moonsea-controls__title">
          月海主题
          <span>实时生效</span>
        </div>
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
      </section>
      <button class="moonsea-controls__toggle" type="button" title="调节界面透明度" aria-label="调节界面透明度" aria-expanded="false">
        <span aria-hidden="true">◐</span>
        <span>透明度</span>
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

    const observer = new MutationObserver(() => {
      if (reportTitlebarButtonStyles()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 15_000);
  };

  const applyTheme = () => {
    document.documentElement.classList.add("codex-moonsea");

    let stylesheet = document.getElementById("codex-moonsea-static-theme");
    if (!stylesheet) {
      stylesheet = document.createElement("link");
      stylesheet.id = "codex-moonsea-static-theme";
      stylesheet.rel = "stylesheet";
      stylesheet.href = "./moonsea/theme.css";
    }

    // 放到 head 末尾，确保主题样式排在 Codex 自身动态加载的 CSS 之后。
    document.head.appendChild(stylesheet);
    applySettings();
    void loadSavedWallpaper();
    if (document.body) {
      createAmbientMotion();
      createControls();
      scheduleTitlebarButtonProbe();
    }
  };

  applyTheme();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyTheme, { once: true });
  }
  window.addEventListener("load", applyTheme, { once: true });
  window.addEventListener("beforeunload", () => {
    if (wallpaperObjectUrl) URL.revokeObjectURL(wallpaperObjectUrl);
  });
})();
