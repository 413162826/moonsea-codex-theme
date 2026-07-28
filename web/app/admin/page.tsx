import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "员工数据",
  description: "月海下载、安装活跃与网站流量",
};

type InstallationCountRow = {
  total: number;
  online15m: number;
  active7d: number;
  active30d: number;
};

type MetricSummaryRow = {
  total: number;
  today: number;
  recent7d: number;
  recent30d: number;
};

type DownloadVisitorSummaryRow = {
  total: number;
  repeatedDownloads: number;
};

type DistributionRow = {
  label: string;
  total: number;
};

type DailyRow = {
  day: string;
  total: number;
};

const METRIC_LABELS: Record<string, string> = {
  win32: "Windows",
  windows: "Windows",
  darwin: "macOS",
  macos: "macOS",
  linux: "Linux",
  "/": "首页",
  "/themes": "主题墙",
  "/download/choose": "下载选择页",
};

function allowedAdminEmails() {
  return new Set(
    String(env.MOONSEA_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function metricSummary(metricType: string) {
  return (await env.DB.prepare(`
    SELECT
      COALESCE(SUM(total), 0) AS total,
      COALESCE(SUM(CASE WHEN day = date('now') THEN total ELSE 0 END), 0) AS today,
      COALESCE(SUM(CASE WHEN day >= date('now', '-6 days') THEN total ELSE 0 END), 0) AS recent7d,
      COALESCE(SUM(CASE WHEN day >= date('now', '-29 days') THEN total ELSE 0 END), 0) AS recent30d
    FROM daily_metrics
    WHERE metric_type = ?
  `).bind(metricType).first<MetricSummaryRow>()) ?? {
    total: 0,
    today: 0,
    recent7d: 0,
    recent30d: 0,
  };
}

async function loadStatistics() {
  const [
    counts,
    versions,
    platforms,
    activeDaily,
    downloads,
    downloadVisitors,
    pageViews,
    trafficDaily,
    trafficPages,
    downloadPlatforms,
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN datetime(last_seen_at) >= datetime('now', '-15 minutes') THEN 1 ELSE 0 END) AS online15m,
        SUM(CASE WHEN datetime(last_seen_at) >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS active7d,
        SUM(CASE WHEN datetime(last_seen_at) >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS active30d
      FROM installations
    `).first<InstallationCountRow>(),
    env.DB.prepare(`
      SELECT app_version AS label, COUNT(*) AS total
      FROM installations
      GROUP BY app_version
      ORDER BY total DESC, app_version DESC
      LIMIT 8
    `).all<DistributionRow>(),
    env.DB.prepare(`
      SELECT platform AS label, COUNT(*) AS total
      FROM installations
      GROUP BY platform
      ORDER BY total DESC
    `).all<DistributionRow>(),
    env.DB.prepare(`
      SELECT substr(last_seen_at, 1, 10) AS day, COUNT(*) AS total
      FROM installations
      WHERE datetime(last_seen_at) >= datetime('now', '-30 days')
      GROUP BY substr(last_seen_at, 1, 10)
      ORDER BY day ASC
    `).all<DailyRow>(),
    metricSummary("download"),
    env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(download_count - 1), 0) AS repeatedDownloads
      FROM download_visitors
    `).first<DownloadVisitorSummaryRow>(),
    metricSummary("page_view"),
    env.DB.prepare(`
      SELECT day, SUM(total) AS total
      FROM daily_metrics
      WHERE metric_type = 'page_view' AND day >= date('now', '-29 days')
      GROUP BY day
      ORDER BY day ASC
    `).all<DailyRow>(),
    env.DB.prepare(`
      SELECT dimension AS label, SUM(total) AS total
      FROM daily_metrics
      WHERE metric_type = 'page_view'
      GROUP BY dimension
      ORDER BY total DESC
    `).all<DistributionRow>(),
    env.DB.prepare(`
      SELECT dimension AS label, SUM(total) AS total
      FROM daily_metrics
      WHERE metric_type = 'download'
      GROUP BY dimension
      ORDER BY total DESC
    `).all<DistributionRow>(),
  ]);

  return {
    counts: counts ?? { total: 0, online15m: 0, active7d: 0, active30d: 0 },
    versions: versions.results,
    platforms: platforms.results,
    activeDaily: activeDaily.results,
    downloads,
    downloadVisitors: downloadVisitors ?? { total: 0, repeatedDownloads: 0 },
    pageViews,
    trafficDaily: trafficDaily.results,
    trafficPages: trafficPages.results,
    downloadPlatforms: downloadPlatforms.results,
  };
}

function Distribution({ title, rows }: { title: string; rows: DistributionRow[] }) {
  const maximum = Math.max(...rows.map((row) => row.total), 1);
  return (
    <section className="data-card">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="empty-data">还没有数据</p> : (
        <ul className="distribution-list">
          {rows.map((row) => (
            <li key={row.label}>
              <div><span>{METRIC_LABELS[row.label] ?? row.label}</span><strong>{row.total}</strong></div>
              <i style={{ width: `${Math.max(4, row.total / maximum * 100)}%` }} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Trend({ title, rows, empty }: { title: string; rows: DailyRow[]; empty: string }) {
  const maximum = Math.max(...rows.map((row) => row.total), 1);
  return (
    <section className="data-card activity-card">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="empty-data">{empty}</p> : (
        <div className="activity-chart" aria-label={title}>
          {rows.map((row) => (
            <div key={row.day}>
              <span
                style={{ height: `${Math.max(8, row.total / maximum * 100)}%` }}
                title={`${row.day}：${row.total}`}
              />
              <small>{row.day.slice(5)}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  if (!allowedAdminEmails().has(user.email.toLowerCase())) {
    return (
      <main className="admin-shell admin-denied">
        <p className="admin-status-code">403</p>
        <h1>这个账号没有员工权限。</h1>
        <p>当前登录账号：{user.email}</p>
        <a href={chatGPTSignOutPath("/admin")}>切换账号</a>
      </main>
    );
  }

  const data = await loadStatistics();

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>员工数据</h1>
          <p>下载、安装活跃与网站流量</p>
        </div>
        <div className="admin-account">
          <span>{user.displayName}</span>
          <Link href="/">返回官网</Link>
        </div>
      </header>

      <section className="admin-section" aria-labelledby="usage-title">
        <div className="admin-section__heading">
          <h2 id="usage-title">下载与使用</h2>
          <p>下载按点击次数统计；下载访客按匿名浏览器标识去重，不采集硬件指纹。更换浏览器或清除站点数据后会视为新访客。</p>
        </div>
        <div className="metric-grid metric-grid--usage" aria-label="下载与使用指标">
          <article><span>累计下载次数</span><strong>{data.downloads.total}</strong></article>
          <article><span>已识别下载访客</span><strong>{data.downloadVisitors.total}</strong><small>自新口径上线起</small></article>
          <article><span>重复下载次数</span><strong>{data.downloadVisitors.repeatedDownloads}</strong><small>同一浏览器再次下载</small></article>
          <article><span>累计安装设备</span><strong>{data.counts.total}</strong></article>
          <article><span>当前在线设备</span><strong>{data.counts.online15m}</strong><small>近 15 分钟有心跳</small></article>
          <article><span>7 日活跃设备</span><strong>{data.counts.active7d}</strong></article>
          <article><span>30 日活跃设备</span><strong>{data.counts.active30d}</strong></article>
        </div>
        <Trend title="近 30 日设备活跃" rows={data.activeDaily} empty="新版本开始上报后，这里会出现趋势。" />
        <div className="data-grid data-grid--three">
          <Distribution title="安装系统分布" rows={data.platforms} />
          <Distribution title="版本分布" rows={data.versions} />
          <Distribution title="下载系统分布" rows={data.downloadPlatforms} />
        </div>
      </section>

      <section className="admin-section" aria-labelledby="traffic-title">
        <div className="admin-section__heading">
          <h2 id="traffic-title">网站流量</h2>
          <p>仅统计公开页面的访问次数，不使用 Cookie 或访客标识。</p>
        </div>
        <div className="metric-grid" aria-label="网站流量指标">
          <article><span>今日 PV</span><strong>{data.pageViews.today}</strong></article>
          <article><span>7 日 PV</span><strong>{data.pageViews.recent7d}</strong></article>
          <article><span>30 日 PV</span><strong>{data.pageViews.recent30d}</strong></article>
        </div>
        <Trend title="近 30 日页面访问" rows={data.trafficDaily} empty="站点产生访问后，这里会出现趋势。" />
        <div className="data-grid">
          <Distribution title="页面访问分布" rows={data.trafficPages} />
          <section className="data-card metric-note">
            <h2>统计口径</h2>
            <dl>
              <div><dt>累计 PV</dt><dd>{data.pageViews.total}</dd></div>
              <div><dt>今日下载</dt><dd>{data.downloads.today}</dd></div>
              <div><dt>7 日下载</dt><dd>{data.downloads.recent7d}</dd></div>
              <div><dt>30 日下载</dt><dd>{data.downloads.recent30d}</dd></div>
            </dl>
          </section>
        </div>
      </section>
    </main>
  );
}
