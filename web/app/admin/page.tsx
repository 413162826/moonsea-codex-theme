import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "管理员数据",
  description: "月海匿名安装与活跃数据",
};

type CountRow = {
  total: number;
  active7d: number;
  active30d: number;
};

type DistributionRow = {
  label: string;
  total: number;
};

type DailyRow = {
  day: string;
  total: number;
};

function allowedAdminEmails() {
  return new Set(
    String(env.MOONSEA_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function loadStatistics() {
  const [counts, versions, platforms, daily] = await Promise.all([
    env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN last_seen_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS active7d,
        SUM(CASE WHEN last_seen_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS active30d
      FROM installations
    `).first<CountRow>(),
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
      WHERE last_seen_at >= datetime('now', '-30 days')
      GROUP BY substr(last_seen_at, 1, 10)
      ORDER BY day ASC
    `).all<DailyRow>(),
  ]);

  return {
    counts: counts ?? { total: 0, active7d: 0, active30d: 0 },
    versions: versions.results,
    platforms: platforms.results,
    daily: daily.results,
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
              <div><span>{row.label}</span><strong>{row.total}</strong></div>
              <i style={{ width: `${Math.max(4, row.total / maximum * 100)}%` }} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  if (!allowedAdminEmails().has(user.email.toLowerCase())) {
    return (
      <main className="admin-shell admin-denied">
        <p className="section-kicker">403</p>
        <h1>这个账号没有管理员权限。</h1>
        <p>当前登录账号：{user.email}</p>
        <a href={chatGPTSignOutPath("/admin")}>切换账号</a>
      </main>
    );
  }

  const data = await loadStatistics();
  const maximumDaily = Math.max(...data.daily.map((row) => row.total), 1);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="section-kicker">MOONSEA ADMIN</p>
          <h1>管理员数据</h1>
          <p>匿名安装与活跃趋势</p>
        </div>
        <div className="admin-account">
          <span>{user.displayName}</span>
          <Link href="/">返回官网</Link>
        </div>
      </header>

      <section className="metric-grid" aria-label="核心指标">
        <article><span>累计安装</span><strong>{data.counts.total}</strong><small>主动授权的匿名设备</small></article>
        <article><span>7 日活跃</span><strong>{data.counts.active7d}</strong><small>最近 7 天有上报</small></article>
        <article><span>30 日活跃</span><strong>{data.counts.active30d}</strong><small>最近 30 天有上报</small></article>
      </section>

      <section className="data-card activity-card">
        <h2>近 30 日活跃</h2>
        {data.daily.length === 0 ? <p className="empty-data">首批用户授权后，这里会出现趋势。</p> : (
          <div className="activity-chart" aria-label="近 30 日活跃趋势">
            {data.daily.map((row) => (
              <div key={row.day}>
                <span style={{ height: `${Math.max(8, row.total / maximumDaily * 100)}%` }} title={`${row.day}：${row.total}`} />
                <small>{row.day.slice(5)}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="data-grid">
        <Distribution title="版本分布" rows={data.versions} />
        <Distribution title="系统分布" rows={data.platforms} />
      </div>
    </main>
  );
}
