export type SiteUpdateImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type SiteUpdate = {
  id: string;
  date: string;
  displayDate: string;
  kind: "站点更新" | "版本" | "壁纸上新";
  category: UpdateCategory;
  version: string;
  title: string;
  summary: string;
  details: string[];
  images?: SiteUpdateImage[];
  releaseUrl?: string;
  current?: boolean;
};

export type UpdateCategory = "新功能" | "体验优化" | "修复";

export const SITE_UPDATES: SiteUpdate[] = [
  {
    id: "wallpapers-2026-08-01",
    date: "2026-08-01",
    displayDate: "8 月 1 日",
    kind: "壁纸上新",
    category: "新功能",
    version: "NEW",
    title: "今日四张新壁纸",
    summary:
      "月海壁纸工厂今日上线四个原创主题：晨星换灯人、红月折扇剧场、彗星理发章鱼与睡莲星港。",
    details: [
      "四张壁纸均已进入远程主题清单，用户点击应用即可自动获取并生效。",
      "题材覆盖虚构舞台氛围、搞怪角色与梦境科幻，保持工作区文字可读。",
      "预览图直接来自公开主题资源，页面展示与实际可应用内容保持一致。",
    ],
    images: [
      {
        src: "/api/themes/assets/dawn-star-lamplighter",
        alt: "晨星换灯人壁纸预览",
        width: 1600,
        height: 900,
      },
      {
        src: "/api/themes/assets/red-moon-fan-theater",
        alt: "红月折扇剧场壁纸预览",
        width: 1600,
        height: 900,
      },
      {
        src: "/api/themes/assets/comet-barber-octopus",
        alt: "彗星理发章鱼壁纸预览",
        width: 1600,
        height: 900,
      },
      {
        src: "/api/themes/assets/lotus-starport",
        alt: "睡莲星港壁纸预览",
        width: 1600,
        height: 900,
      },
    ],
  },
  {
    id: "wallpapers-2026-07-31",
    date: "2026-07-31",
    displayDate: "7 月 31 日",
    kind: "壁纸上新",
    category: "新功能",
    version: "NEW",
    title: "四张原创壁纸加入主题墙",
    summary:
      "月轨快递员、零点潮汐舞台、宇宙修理熊与鲸梦邮局完成上传并公开，主题墙开始持续更新。",
    details: [
      "每张主题都使用原创角色与场景，不直接使用现成动漫或真人 IP。",
      "壁纸、配色、可读性遮罩与一键应用信息一并进入远程清单。",
      "未安装助手的访客也可以先打开模拟窗口预览完整工作氛围。",
    ],
    images: [
      {
        src: "/api/themes/assets/moon-rail-courier",
        alt: "月轨快递员壁纸预览",
        width: 1600,
        height: 900,
      },
      {
        src: "/api/themes/assets/midnight-tide-stage",
        alt: "零点潮汐舞台壁纸预览",
        width: 1600,
        height: 900,
      },
      {
        src: "/api/themes/assets/cosmic-repair-bear",
        alt: "宇宙修理熊壁纸预览",
        width: 1600,
        height: 900,
      },
      {
        src: "/api/themes/assets/whale-dream-post-office",
        alt: "鲸梦邮局壁纸预览",
        width: 1600,
        height: 900,
      },
    ],
  },
  {
    id: "unified-theme-wall",
    date: "2026-07-31",
    displayDate: "7 月 31 日",
    kind: "站点更新",
    category: "新功能",
    version: "现在",
    title: "一个主题墙，两个工作台",
    summary:
      "Codex 与 WorkBuddy 现在共享同一套月海主题。切换应用对象时，页面保持原位，只改变连接状态、应用目标和下载内容。",
    details: [
      "主题墙不再拆成两个重复页面，浏览路径更短。",
      "未安装月海助手也能打开模拟窗口预览；当天上新的主题会显示 NEW。",
      "首页、导航与品牌标记完成统一，管理员入口收进页脚品牌名。",
    ],
    images: [
      {
        src: "/og.png",
        alt: "月海主题站首页与主题预览",
        width: 1731,
        height: 909,
      },
    ],
    current: true,
  },
  {
    id: "v1-5-9",
    date: "2026-07-31",
    displayDate: "7 月 31 日",
    kind: "版本",
    category: "新功能",
    version: "v1.5.9",
    title: "WorkBuddy 正式加入月海",
    summary:
      "月海助手扩展到 WorkBuddy：同一套主题可在两个工作台之间切换，完整的壁纸与主题桥已经接通。",
    details: [
      "新增 WorkBuddy 月海版安装、更新与卸载链路。",
      "壁纸、透明层、阅读对比度与月海助手控制面板保持一致。",
      "主题上传与远程分发进入统一流程，为持续上新做好准备。",
    ],
    images: [
      {
        src: "/theme-assets/tide-dragon-realm.png",
        alt: "潮汐龙境主题在工作台中的预览",
        width: 1055,
        height: 588,
      },
    ],
    releaseUrl:
      "https://github.com/413162826/moonsea-codex-theme/releases/tag/v1.5.9",
  },
  {
    id: "v1-5-8",
    date: "2026-07-30",
    displayDate: "7 月 30 日",
    kind: "版本",
    category: "体验优化",
    version: "v1.5.8",
    title: "新壁纸，不再要求升级整个助手",
    summary:
      "主题清单改为远程更新。月海上新壁纸后，用户点击应用，助手会自动获取、校验、缓存并生效。",
    details: [
      "不需要手动选择下载目录，也不需要搬运图片文件。",
      "下载前校验文件完整性，失败不会覆盖当前正在使用的主题。",
      "官网预览、主题清单与助手应用使用同一份主题信息。",
    ],
    images: [
      {
        src: "/theme-assets/moonlit-silent.png",
        alt: "月海无声主题在工作台中的预览",
        width: 1664,
        height: 936,
      },
    ],
    releaseUrl:
      "https://github.com/413162826/moonsea-codex-theme/releases/tag/v1.5.8",
  },
  {
    id: "v1-5-7",
    date: "2026-07-30",
    displayDate: "7 月 30 日",
    kind: "版本",
    category: "修复",
    version: "v1.5.7",
    title: "让下载与发布更可信",
    summary:
      "我们开始区分访问、下载、设备与自动化流量，并把 Windows 发布流程改造成可追踪的生命周期。",
    details: [
      "匿名统计按设备随机标识去重，不采集硬件指纹。",
      "机器人、自测与无法确认的流量可以单列，不再混入真实成果。",
      "Windows 候选包、正式发布与下载入口之间有了明确状态。",
    ],
    releaseUrl:
      "https://github.com/413162826/moonsea-codex-theme/releases/tag/v1.5.7",
  },
  {
    id: "v1-5-6",
    date: "2026-07-27",
    displayDate: "7 月 27 日",
    kind: "版本",
    category: "修复",
    version: "v1.5.6",
    title: "更新链路开始可验证、可恢复",
    summary:
      "版本发布不再只是上传一个安装包：候选构建、验收、放行与更新恢复开始使用同一套可验证证据。",
    details: [
      "安装包与更新包来自同一批构建产物。",
      "发布前必须通过真实安装与更新验证。",
      "中断的更新可以恢复，不把半完成状态留给用户。",
    ],
    releaseUrl:
      "https://github.com/413162826/moonsea-codex-theme/releases/tag/v1.5.6",
  },
];
