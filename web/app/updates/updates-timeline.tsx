"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { SiteUpdate, SiteUpdateImage, UpdateCategory } from "../../lib/site-updates";

const FILTERS: Array<{ value: "all" | UpdateCategory; label: string }> = [
  { value: "all", label: "全部" },
  { value: "新功能", label: "新功能" },
  { value: "体验优化", label: "体验优化" },
  { value: "修复", label: "修复" },
];

function UpdateImage({
  image,
  loading,
  priority = false,
}: {
  image: SiteUpdateImage;
  loading: "eager" | "lazy";
  priority?: boolean;
}) {
  return (
    <Image
      alt={image.alt}
      height={image.height}
      loading={loading}
      priority={priority}
      sizes="(max-width: 760px) 100vw, 420px"
      src={image.src}
      unoptimized
      width={image.width}
    />
  );
}

function UpdateEntryMedia({
  images,
  title,
  updateIndex,
  onOpen,
}: {
  images: SiteUpdateImage[];
  title: string;
  updateIndex: number;
  onOpen: () => void;
}) {
  if (images.length === 1) {
    return (
      <div className="update-entry__media">
        <UpdateImage
          image={images[0]}
          loading={updateIndex === 0 ? "eager" : "lazy"}
          priority={updateIndex === 0}
        />
      </div>
    );
  }

  const backImages = images.slice(1, 3).reverse();
  return (
    <button
      aria-label={`打开${title}的${images.length}张壁纸预览`}
      className="update-entry__media update-entry__media--stack"
      onClick={onOpen}
      type="button"
    >
      <span className="preview-stack__count">{images.length} 张预览</span>
      {backImages.map((image, index) => (
        <span
          aria-hidden="true"
          className={`preview-stack__card ${index === 0 ? "preview-stack__card--back-two" : "preview-stack__card--back-one"}`}
          key={image.src}
        >
          <UpdateImage image={{ ...image, alt: "" }} loading="lazy" />
        </span>
      ))}
      <span className="preview-stack__card preview-stack__card--front">
        <UpdateImage
          image={images[0]}
          loading={updateIndex === 0 ? "eager" : "lazy"}
          priority={updateIndex === 0}
        />
      </span>
      <span className="preview-stack__hint">点击查看全部</span>
    </button>
  );
}

function UpdateGallery({ update, onClose }: { update: SiteUpdate; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      aria-label="壁纸预览画廊"
      className="update-gallery"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-labelledby="update-gallery-title"
        aria-modal="true"
        className="update-gallery__surface"
        role="dialog"
      >
        <header className="update-gallery__header">
          <div>
            <p>壁纸预览</p>
            <h2 id="update-gallery-title">{update.title}</h2>
          </div>
          <button aria-label="关闭壁纸预览" className="update-gallery__close" onClick={onClose} type="button">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="update-gallery__grid">
          {update.images?.map((image) => (
            <figure className="update-gallery__item" key={image.src}>
              <Image
                alt={image.alt}
                height={image.height}
                loading="eager"
                sizes="(max-width: 760px) 100vw, 520px"
                src={image.src}
                unoptimized
                width={image.width}
              />
              <figcaption>{image.alt.replace(/壁纸预览$/, "")}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

export function UpdatesTimeline({ updates }: { updates: SiteUpdate[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [galleryUpdateId, setGalleryUpdateId] = useState<string | null>(null);
  const visibleUpdates = useMemo(
    () => filter === "all" ? updates : updates.filter((update) => update.category === filter),
    [filter, updates],
  );
  const galleryUpdate = updates.find((update) => update.id === galleryUpdateId);
  const closeGallery = () => setGalleryUpdateId(null);

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
                  <UpdateEntryMedia
                    images={update.images}
                    onOpen={() => setGalleryUpdateId(update.id)}
                    title={update.title}
                    updateIndex={updateIndex}
                  />
                ) : null}
              </div>
            </article>
          </li>
        ))}
      </ol>

      {galleryUpdate?.images?.length ? <UpdateGallery onClose={closeGallery} update={galleryUpdate} /> : null}
    </section>
  );
}
