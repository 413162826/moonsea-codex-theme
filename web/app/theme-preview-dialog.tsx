"use client";

import { useEffect, useRef } from "react";
import {
  CLIENT_TARGETS,
  type ClientTarget,
} from "../lib/client-target";
import type { Theme } from "../lib/theme-catalog";
import { ProCodexPreview, StandardCodexPreview } from "./codex-preview";

export function ThemePreviewDialog({
  theme,
  client,
  actionLabel,
  actionDisabled,
  onApply,
  onClose,
}: {
  theme: Theme;
  client: ClientTarget;
  actionLabel: string;
  actionDisabled: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const clientLabel = CLIENT_TARGETS[client].label;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="theme-preview-dialog"
      aria-labelledby="theme-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        dialogRef.current?.close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      onClose={onClose}
    >
      <div className="theme-preview-dialog__surface">
        <header className="theme-preview-dialog__header">
          <div>
            <span>模拟预览 · {clientLabel}</span>
            <h2 id="theme-preview-title">{theme.name}</h2>
          </div>
          <button
            className="theme-preview-dialog__close"
            type="button"
            aria-label="关闭预览"
            onClick={() => dialogRef.current?.close()}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div
          className={`theme-preview-dialog__stage ${theme.edition === "pro" ? "is-pro" : ""}`}
          style={{ background: theme.previewGradient }}
        >
          {theme.edition === "pro"
            ? (
                <ProCodexPreview
                  theme={theme}
                  className="theme-preview-dialog__window"
                  productLabel={clientLabel}
                />
              )
            : (
                <StandardCodexPreview
                  theme={theme}
                  className="theme-preview-dialog__window"
                  productLabel={clientLabel}
                />
              )}
        </div>

        <footer className="theme-preview-dialog__footer">
          <p>
            这是主题在 {clientLabel} 中的模拟效果。预览无需安装或连接月海助手。
          </p>
          <div>
            <button
              className="theme-preview-dialog__secondary"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              继续浏览
            </button>
            <button
              className="theme-preview-dialog__primary"
              type="button"
              disabled={actionDisabled}
              onClick={onApply}
            >
              {actionLabel}
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
