import type { Theme } from "./theme-catalog";

export function isThemeNewToday(theme: Theme, today = new Date()) {
  if (!theme.createdAt) return false;
  const createdAt = new Date(theme.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;

  return createdAt.getFullYear() === today.getFullYear()
    && createdAt.getMonth() === today.getMonth()
    && createdAt.getDate() === today.getDate();
}
