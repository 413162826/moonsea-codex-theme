export type PreviewTheme = {
  name: string;
  mode: "light" | "dark";
  previewGradient: string;
  previewImage?: string;
};

export function StandardCodexPreview({ theme }: { theme: PreviewTheme }) {
  return (
    <div className={`mock-window ${theme.mode}`} aria-hidden="true">
      <div className="mock-titlebar"><i />Codex · {theme.name}</div>
      <div className="mock-shell">
        <aside><span /><span /><span /></aside>
        <div><b>Build a product people remember</b><span /><span /><em /></div>
      </div>
    </div>
  );
}

export function ProCodexPreview({
  theme,
  className = "",
}: {
  theme: PreviewTheme;
  className?: string;
}) {
  const wallpaper = theme.previewImage?.replace("./", "/");
  return (
    <div className={`pro-codex-window ${className}`.trim()} aria-hidden="true">
      <div className="pro-codex-titlebar">
        <div className="pro-codex-menu">
          <i />
          <span>Codex</span>
          <span>文件</span>
          <span>编辑</span>
        </div>
        <div className="pro-codex-window-actions"><i /><i /><i /></div>
      </div>
      <div
        className="pro-codex-body"
        style={{
          backgroundImage: wallpaper
            ? `linear-gradient(110deg, rgba(5, 19, 28, .28), rgba(5, 19, 28, .06)), url("${wallpaper}")`
            : theme.previewGradient,
        }}
      >
        <aside className="pro-codex-sidebar">
          <strong><i />Codex</strong>
          <div className="pro-codex-nav"><span /><span /><span /><span /></div>
          <div className="pro-codex-project">
            <small>项目</small>
            <span /><span /><span />
          </div>
        </aside>
        <div className="pro-codex-workspace">
          <div className="pro-codex-thread"><span /><span /></div>
          <div className="pro-codex-welcome">
            <i />
            <strong>我们该构建什么？</strong>
          </div>
          <div className="pro-codex-composer">
            <span>随心输入</span>
            <i>↑</i>
          </div>
        </div>
      </div>
    </div>
  );
}
