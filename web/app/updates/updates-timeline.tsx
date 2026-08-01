"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { SiteUpdate, UpdateCategory } from "../../lib/site-updates";

const FILTERS: Array<{ value: "all" | UpdateCategory; label: string }> = [
  { value: "all", label: "全部" },
  { value: "新功能", label: "新功能" },
  { value: "体验优化", label: "体验优化" },
  { value: "修复", label: "修复" },
];

export function UpdatesTimeline({ updates }: { updates: SiteUpdate[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const visibleUpdates = useMemo(
    () => filter === "all" ? updates : updates.filter((update) => update.category === filter),
    [filter, updates],
  );

  return (
    <section className="updates-log" aria-label="更新筛选与发布记录">
      <div className="updates-filters" role="group" aria-label="按类型筛选更新">
        {FILTERS.map((item) => (
          <button
            aria-pressed={filter === item.value}
            className={filter === item.value ? "is-active" : ""}
            key={item.value}
            onClick={() => setFilter(item.value)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <ol className="updates-timeline" aria-label="月海更新记录">
        {visibleUpdates.map((update, updateIndex) => (
          <li className="update-entry" id={update.id} key={update.id}>
            <div className="update-entry__meta">
              <time dateTime={update.date}>{update.displayDate}</time>
              <span>{update.kind}</span>
            </div>

            <div className="update-entry__rail" aria-hidden="true">
              <span className="update-entry__node" />
            </div>

            <article className="update-entry__content">
              <div className="update-entry__badges">
                <span className="update-entry__version">{update.version}</span>
                <span className="update-entry__category">{update.category}</span>
                {update.current ? <span className="update-entry__current">当前</span> : null}
              </div>

              <div className={`update-entry__grid ${update.images?.length ? "has-media" : ""}`}>
                <div className="update-entry__copy">
                  <h2>{update.title}</h2>
                  <p className="update-entry__summary">{update.summary}</p>
                  <ul>
                    {update.details.map((detail) => <li key={detail}>{detail}</li>)}
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
                </div>

                {update.images?.length ? (
                  <div className="update-entry__media">
                    {update.images.map((image, imageIndex) => (
                      <Image
                        alt={image.alt}
                        height={image.height}
                        key={image.src}
                        loading={updateIndex === 0 && imageIndex === 0 ? "eager" : "lazy"}
                        priority={updateIndex === 0 && imageIndex === 0}
                        sizes="(max-width: 760px) 100vw, 420px"
                        src={image.src}
                        unoptimized
                        width={image.width}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
