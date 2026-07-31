export type ClientTarget = "codex" | "workbuddy";

export const CLIENT_TARGETS: Record<
  ClientTarget,
  { label: "Codex" | "WorkBuddy"; apiRoot: string }
> = {
  codex: {
    label: "Codex",
    apiRoot: "http://127.0.0.1:17321",
  },
  workbuddy: {
    label: "WorkBuddy",
    apiRoot: "http://127.0.0.1:17322",
  },
};

export function resolveClientTarget(value?: string | null): ClientTarget {
  return value === "workbuddy" ? "workbuddy" : "codex";
}
