"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type UploadResult = {
  theme?: {
    id: string;
    name: string;
  };
  error?: string;
};

export function ThemeUploadForm() {
  const [status, setStatus] = useState("");
  const [createdTheme, setCreatedTheme] = useState<UploadResult["theme"]>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("正在上传并发布…");
    setCreatedTheme(undefined);
    const form = event.currentTarget;
    const fields = new FormData(form);
    const wallpaper = fields.get("wallpaper");
    if (!(wallpaper instanceof File) || wallpaper.size === 0) {
      setStatus("请选择 PNG 壁纸。");
      return;
    }

    const metadata = {
      id: fields.get("id"),
      name: fields.get("name"),
      description: fields.get("description"),
      mode: fields.get("mode"),
      accent: fields.get("accent"),
      surface: fields.get("surface"),
      ink: fields.get("ink"),
      wallpaperPosition: fields.get("wallpaperPosition"),
    };
    const body = new FormData();
    body.set("metadata", JSON.stringify(metadata));
    body.set("wallpaper", wallpaper);

    try {
      const response = await fetch("/api/admin/themes", {
        method: "POST",
        body,
      });
      const result = await response.json() as UploadResult;
      if (!response.ok || !result.theme) {
        throw new Error(result.error ?? "上传失败");
      }
      setCreatedTheme(result.theme);
      setStatus(`“${result.theme.name}”已发布。`);
      form.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "上传失败");
    }
  };

  return (
    <form className="theme-upload-form" onSubmit={(event) => void submit(event)}>
      <label>
        <span>主题 ID</span>
        <input name="id" required pattern="[a-z0-9-]+" placeholder="neon-rain-town" />
      </label>
      <label>
        <span>主题名称</span>
        <input name="name" required minLength={2} maxLength={24} placeholder="霓虹雨町" />
      </label>
      <label className="theme-upload-form__wide">
        <span>主题描述</span>
        <input
          name="description"
          required
          minLength={8}
          maxLength={100}
          placeholder="海边雨站与原创动漫信使，适合沉浸式夜间编程"
        />
      </label>
      <label>
        <span>明暗模式</span>
        <select name="mode" defaultValue="dark">
          <option value="dark">深色</option>
          <option value="light">浅色</option>
        </select>
      </label>
      <label>
        <span>强调色</span>
        <input name="accent" required pattern="#[0-9A-F]{6}" defaultValue="#D9894E" />
      </label>
      <label>
        <span>表面色</span>
        <input name="surface" required pattern="#[0-9A-F]{6}" defaultValue="#081623" />
      </label>
      <label>
        <span>文字色</span>
        <input name="ink" required pattern="#[0-9A-F]{6}" defaultValue="#EDF4F6" />
      </label>
      <label>
        <span>壁纸焦点</span>
        <input name="wallpaperPosition" required pattern="\d+% \d+%" defaultValue="50% 50%" />
      </label>
      <label className="theme-upload-form__wide">
        <span>PNG 壁纸</span>
        <input name="wallpaper" type="file" accept="image/png" required />
      </label>
      <div className="theme-upload-form__actions">
        <button type="submit">上传并发布</button>
        <p aria-live="polite">{status}</p>
        {createdTheme
          ? <Link href={`/themes/${createdTheme.id}`}>查看主题</Link>
          : null}
      </div>
    </form>
  );
}
