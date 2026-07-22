const CODE_FONT_STACK = 'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

const standardThemes = [
  {
    id: "moon-white",
    name: "月白",
    description: "冷白底与深青字，适合长时间阅读",
    edition: "standard",
    mode: "light",
    preview: ["#F7F9FA", "#E2EAED", "#176E83", "#17272F"],
    previewGradient: "radial-gradient(circle at 22% 18%, #FFFFFF 0 16%, transparent 46%), linear-gradient(145deg, #F7FAFB 0%, #D7E6E9 58%, #8AB5BE 100%)",
    patch: {
      accent: "#176E83",
      surface: "#F7F9FA",
      ink: "#17272F",
      contrast: 32,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#1F7552",
        diffRemoved: "#B13F4A",
        skill: "#6752A2",
      },
    },
  },
  {
    id: "mist-blue",
    name: "潮雾",
    description: "蓝灰层次更明确，适合多面板工作",
    edition: "standard",
    mode: "light",
    preview: ["#E3EDF2", "#CADAE2", "#2A678B", "#132934"],
    previewGradient: "radial-gradient(circle at 78% 18%, #F4FBFD 0 12%, transparent 44%), linear-gradient(145deg, #E7F2F6 0%, #B6D1DB 55%, #568AA1 100%)",
    patch: {
      accent: "#2A678B",
      surface: "#E3EDF2",
      ink: "#132934",
      contrast: 42,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#176D4F",
        diffRemoved: "#A93E49",
        skill: "#62519B",
      },
    },
  },
  {
    id: "deep-sea",
    name: "深海",
    description: "深蓝底与海青强调，适合夜间专注",
    edition: "standard",
    mode: "dark",
    preview: ["#0D1A21", "#19303A", "#60B2C1", "#E5EEF1"],
    previewGradient: "radial-gradient(circle at 78% 20%, #397687 0 8%, transparent 42%), linear-gradient(145deg, #122A34 0%, #0A1820 58%, #040B10 100%)",
    patch: {
      accent: "#60B2C1",
      surface: "#0D1A21",
      ink: "#E5EEF1",
      contrast: 44,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#69C79B",
        diffRemoved: "#F1848C",
        skill: "#C1A2E7",
      },
    },
  },
  {
    id: "ink-night",
    name: "夜航",
    description: "中性墨黑与月蓝强调，适合低光环境",
    edition: "standard",
    mode: "dark",
    preview: ["#171D24", "#282F39", "#8BA9D6", "#E9EEF2"],
    previewGradient: "radial-gradient(circle at 20% 20%, #405A7B 0 10%, transparent 40%), linear-gradient(145deg, #28313E 0%, #151B23 60%, #090D12 100%)",
    patch: {
      accent: "#8BA9D6",
      surface: "#171D24",
      ink: "#E9EEF2",
      contrast: 36,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#72C69D",
        diffRemoved: "#F08B91",
        skill: "#C0A6DB",
      },
    },
  },
  {
    id: "tundra-green",
    name: "苔原",
    description: "灰绿底与松针色，适合长时间编排",
    edition: "standard",
    mode: "light",
    preview: ["#EEF2EC", "#D6E1D7", "#376B58", "#1E2A24"],
    previewGradient: "radial-gradient(circle at 18% 78%, #AFC7B7 0 14%, transparent 46%), linear-gradient(158deg, #F5F7F3 0%, #D6E1D7 54%, #6D927F 100%)",
    patch: {
      accent: "#376B58",
      surface: "#EEF2EC",
      ink: "#1E2A24",
      contrast: 38,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#246247",
        diffRemoved: "#9D3F47",
        skill: "#594985",
      },
    },
  },
  {
    id: "distant-ridge",
    name: "远岫",
    description: "蓝紫灰与鸢尾色，适合文档审阅",
    edition: "standard",
    mode: "light",
    preview: ["#EEF0F5", "#D7DBE8", "#5A648B", "#222936"],
    previewGradient: "conic-gradient(from 214deg at 78% 28%, #F7F6FA 0 18%, #D7DBE8 18% 42%, #9AA3BF 42% 56%, #EEF0F5 56% 100%)",
    patch: {
      accent: "#5A648B",
      surface: "#EEF0F5",
      ink: "#222936",
      contrast: 40,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#2A674F",
        diffRemoved: "#A13F4D",
        skill: "#66519B",
      },
    },
  },
  {
    id: "morning-frost",
    name: "晨霜",
    description: "冷灰底与雾蓝色，适合明亮环境",
    edition: "standard",
    mode: "light",
    preview: ["#F1F3F4", "#D7DEE3", "#4D6879", "#252C30"],
    previewGradient: "radial-gradient(ellipse at 76% 82%, #AABDC8 0 13%, transparent 39%), linear-gradient(12deg, #CBD6DC 0 26%, #F1F3F4 27% 66%, #E1E7EA 67% 100%)",
    patch: {
      accent: "#4D6879",
      surface: "#F1F3F4",
      ink: "#252C30",
      contrast: 34,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#2D684B",
        diffRemoved: "#A13F48",
        skill: "#5F4D8F",
      },
    },
  },
  {
    id: "pine-shadow",
    name: "松影",
    description: "墨绿底与玉青色，适合持续专注",
    edition: "standard",
    mode: "dark",
    preview: ["#13201C", "#263B34", "#72B49A", "#E7F0EB"],
    previewGradient: "linear-gradient(112deg, #2C4A40 0 18%, #172A24 18% 43%, #4F7D6B 43% 46%, #13201C 46% 74%, #0D1714 74% 100%)",
    patch: {
      accent: "#72B49A",
      surface: "#13201C",
      ink: "#E7F0EB",
      contrast: 46,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#77C99E",
        diffRemoved: "#F08E91",
        skill: "#C3A7DE",
      },
    },
  },
  {
    id: "star-ink",
    name: "星墨",
    description: "紫黑底与灰紫色，适合低光创作",
    edition: "standard",
    mode: "dark",
    preview: ["#1B1822", "#31273B", "#B69ACB", "#EFEAF2"],
    previewGradient: "radial-gradient(ellipse at 18% 24%, #665273 0 7%, #31273B 27%, transparent 61%), radial-gradient(circle at 82% 76%, #44354E 0 8%, transparent 42%), linear-gradient(154deg, #211B28 0%, #141119 100%)",
    patch: {
      accent: "#B69ACB",
      surface: "#1B1822",
      ink: "#EFEAF2",
      contrast: 38,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#80C79E",
        diffRemoved: "#EF929A",
        skill: "#CCABE3",
      },
    },
  },
  {
    id: "dusk-harbor",
    name: "暮港",
    description: "石墨蓝与潮蓝色，适合夜间排查",
    edition: "standard",
    mode: "dark",
    preview: ["#1D2229", "#303944", "#7FAFC0", "#E8EEF0"],
    previewGradient: "radial-gradient(circle at 82% 16%, #68788A 0 5%, transparent 31%), linear-gradient(180deg, #303944 0 53%, #7FAFC0 54% 57%, #242A31 58% 73%, #171B20 74% 100%)",
    patch: {
      accent: "#7FAFC0",
      surface: "#1D2229",
      ink: "#E8EEF0",
      contrast: 42,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#7FC195",
        diffRemoved: "#E99192",
        skill: "#B9A5DC",
      },
    },
  },
  {
    id: "glacier-cyan",
    name: "冰川",
    description: "冰蓝底与深青色，适合高亮度屏幕",
    edition: "standard",
    mode: "light",
    preview: ["#E9F2F3", "#C8DEE1", "#176E75", "#152B2F"],
    previewGradient: "conic-gradient(from 198deg at 74% 26%, #F7FBFC 0 20%, #C8DEE1 20% 38%, #75AEB4 38% 46%, #E9F2F3 46% 100%)",
    patch: {
      accent: "#176E75",
      surface: "#E9F2F3",
      ink: "#152B2F",
      contrast: 36,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#246247",
        diffRemoved: "#9D3F47",
        skill: "#594985",
      },
    },
  },
  {
    id: "rain-slate",
    name: "雨巷",
    description: "雨灰底与靛蓝色，适合资料整理",
    edition: "standard",
    mode: "light",
    preview: ["#E8EDF1", "#CED8E0", "#3E6078", "#1E2A33"],
    previewGradient: "linear-gradient(166deg, #F6F8FA 0 28%, #D6E0E6 28% 52%, #8BA4B5 52% 55%, #E8EDF1 55% 82%, #BCCBD5 82% 100%)",
    patch: {
      accent: "#3E6078",
      surface: "#E8EDF1",
      ink: "#1E2A33",
      contrast: 40,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#286449",
        diffRemoved: "#9F3F49",
        skill: "#5D4A8E",
      },
    },
  },
  {
    id: "celadon-mist",
    name: "青瓷",
    description: "青瓷底与黛绿色，适合安静阅读",
    edition: "standard",
    mode: "light",
    preview: ["#E7F0ED", "#CADDD7", "#2F6B62", "#1A2C29"],
    previewGradient: "radial-gradient(ellipse at 22% 24%, #F8FBFA 0 14%, transparent 42%), radial-gradient(circle at 78% 74%, #8FB6AA 0 11%, transparent 39%), linear-gradient(142deg, #D7E6E1 0%, #E7F0ED 62%, #B4CEC6 100%)",
    patch: {
      accent: "#2F6B62",
      surface: "#E7F0ED",
      ink: "#1A2C29",
      contrast: 38,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#236047",
        diffRemoved: "#9B3E47",
        skill: "#584887",
      },
    },
  },
  {
    id: "polar-night",
    name: "极夜",
    description: "深靛底与冰蓝色，适合长夜编码",
    edition: "standard",
    mode: "dark",
    preview: ["#111B26", "#223449", "#73A8D1", "#E8EFF5"],
    previewGradient: "radial-gradient(ellipse at 76% 18%, #365E82 0 9%, transparent 40%), linear-gradient(152deg, #1D3145 0 31%, #111B26 31% 72%, #080E15 100%)",
    patch: {
      accent: "#73A8D1",
      surface: "#111B26",
      ink: "#E8EFF5",
      contrast: 44,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#79C79E",
        diffRemoved: "#F08D94",
        skill: "#C1A6E2",
      },
    },
  },
  {
    id: "violet-tide",
    name: "紫潮",
    description: "紫墨底与藤紫色，适合创意工作",
    edition: "standard",
    mode: "dark",
    preview: ["#1B1827", "#342A48", "#A89AD8", "#F0ECF7"],
    previewGradient: "conic-gradient(from 228deg at 26% 72%, #17131F 0 24%, #342A48 24% 43%, #695D86 43% 50%, #211C2D 50% 78%, #17131F 78% 100%)",
    patch: {
      accent: "#A89AD8",
      surface: "#1B1827",
      ink: "#F0ECF7",
      contrast: 40,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#80C89F",
        diffRemoved: "#EF9299",
        skill: "#C7ACE3",
      },
    },
  },
  {
    id: "storm-cobalt",
    name: "风暴",
    description: "钴灰底与霁蓝色，适合密集排查",
    edition: "standard",
    mode: "dark",
    preview: ["#161D2A", "#2A354A", "#8099CF", "#EDF1F8"],
    previewGradient: "linear-gradient(118deg, #0D121B 0 20%, #2A354A 20% 42%, #8099CF 42% 45%, #1B2434 45% 73%, #111722 73% 100%)",
    patch: {
      accent: "#8099CF",
      surface: "#161D2A",
      ink: "#EDF1F8",
      contrast: 42,
      fonts: {
        ui: null,
        code: CODE_FONT_STACK,
      },
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#7AC69D",
        diffRemoved: "#EF8F96",
        skill: "#BFA7E0",
      },
    },
  },
];

const HEX_COLOR = /^#[0-9A-F]{6}$/;

export function validateStandardTheme(theme) {
  if (!theme || theme.edition !== "standard") {
    throw new Error("只支持普通主题");
  }
  if (!/^[a-z0-9-]+$/.test(theme.id) || !theme.name) {
    throw new Error("主题标识无效");
  }
  if (!new Set(["light", "dark"]).has(theme.mode)) {
    throw new Error("主题模式无效");
  }
  for (const key of ["accent", "surface", "ink"]) {
    if (!HEX_COLOR.test(theme.patch?.[key] ?? "")) {
      throw new Error(`主题颜色 ${key} 无效`);
    }
  }
  if (!Number.isInteger(theme.patch.contrast) || theme.patch.contrast < 0 || theme.patch.contrast > 100) {
    throw new Error("主题对比度无效");
  }
  if (theme.patch.fonts?.ui !== null || typeof theme.patch.fonts?.code !== "string") {
    throw new Error("主题字体无效");
  }
  for (const key of ["diffAdded", "diffRemoved", "skill"]) {
    if (!HEX_COLOR.test(theme.patch.semanticColors?.[key] ?? "")) {
      throw new Error(`主题语义颜色 ${key} 无效`);
    }
  }
  if (!Array.isArray(theme.preview) || theme.preview.length !== 4 || theme.preview.some((color) => !HEX_COLOR.test(color))) {
    throw new Error("主题预览色无效");
  }
  if (typeof theme.previewGradient !== "string" || !theme.previewGradient.includes("gradient(") || /url\(|;/i.test(theme.previewGradient)) {
    throw new Error("主题预览渐变无效");
  }
  if (theme.patch.opaqueWindows !== true) {
    throw new Error("普通主题必须保持窗口不透明");
  }
  return theme;
}

for (const theme of standardThemes) validateStandardTheme(theme);

export const STANDARD_THEMES = Object.freeze(
  standardThemes.map((theme) => Object.freeze(theme)),
);

export function getStandardTheme(themeId) {
  const theme = STANDARD_THEMES.find((item) => item.id === themeId);
  if (!theme) throw new Error(`没有这个普通主题：${themeId}`);
  return theme;
}

export function toPublicTheme(theme) {
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    edition: theme.edition,
    mode: theme.mode,
    preview: theme.preview,
    previewGradient: theme.previewGradient,
  };
}
