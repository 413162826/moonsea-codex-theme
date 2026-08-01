import type { Metadata } from "next";
import Image from "next/image";
import { SITE_URL } from "../../lib/site";
import { SITE_UPDATES } from "../../lib/site-updates";
import { SiteFooter, SiteHeader } from "../site-chrome";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "更新日志",
  description: "沿着月海的发布线，查看主题、壁纸、助手与网站体验的每一次更新。",
  alternates: { canonical: "/updates" },
  openGraph: {
    title: "月海更新日志",
    description: "主题、壁纸、助手与网站体验的持续更新。",
    url: "/updates",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "更新日志",
  description: "沿着月海的发布线，查看主题、壁纸、助手与网站体验的每一次更新。",
  url: new URL("/updates", SITE_URL).toString(),
  mainEntity: {
    "@type": "ItemList",
    itemListElement: SITE_UPDATES.map((update, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: update.title,
      url: new URL(`/updates#${update.id}`, SITE_URL).toString(),
    })),
  },
};

export default function UpdatesPage() {
  return (
    <div className="themes-shell updates-shell">
      <SiteHeader />
      <main className="updates-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <header className="updates-hero">
          <h1>更新日志</h1>
          <p>记录功能更新、体验改进与每一张新壁纸。</p>
        </header>

        <ol className="updates-timeline" aria-label="月海更新记录">
          {SITE_UPDATES.map((update, updateIndex) => (
            <li className="update-entry" id={update.id} key={update.id}>
              <div className="update-entry__meta">
                <time dateTime={update.date}>{update.displayDate}</time>
                <span>{update.kind}</span>
              </div>

              <div className="update-entry__rail" aria-hidden="true">
                <span className="update-entry__node" />
              </div>

              <article className="update-entry__content">
                <div className="update-entry__version">
                  <span>{update.version}</span>
                  {update.current ? <em>当前</em> : null}
                </div>
                <h2>{update.title}</h2>
                <p className="update-entry__summary">{update.summary}</p>

                {update.images?.length ? (
                  <div className="update-entry__media">
                    {update.images.map((image, imageIndex) => (
                      <Image
                        alt={image.alt}
                        height={image.height}
                        key={image.src}
                        priority={updateIndex === 0 && imageIndex === 0}
                        sizes="(max-width: 680px) calc(100vw - 70px), (max-width: 1040px) calc(100vw - 210px), 760px"
                        src={image.src}
                        unoptimized
                        width={image.width}
                      />
                    ))}
                  </div>
                ) : null}

                <ul>
                  {update.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>

                {update.releaseUrl ? (
                  <a
                    className="update-entry__release"
                    href={update.releaseUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    查看完整发布说明 <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </div>
  );
}
