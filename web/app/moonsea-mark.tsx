type MoonseaMarkProps = {
  className?: string;
};

export function MoonseaMark({ className }: MoonseaMarkProps) {
  const classes = ["moonsea-mark", className].filter(Boolean).join(" ");

  return (
    <svg
      className={classes}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="moonsea-mark__moon"
        d="M27.8 5.8A16.3 16.3 0 1 0 39 31.1 13.2 13.2 0 0 1 27.8 5.8Z"
      />
      <path
        className="moonsea-mark__tide moonsea-mark__tide--near"
        d="M5.5 34.6c4.5-3.6 8.8-3.6 13.3 0s8.8 3.6 13.3 0 8.1-3.6 10.4-1.5"
      />
      <path
        className="moonsea-mark__tide moonsea-mark__tide--far"
        d="M9.2 40c3.7-2.6 7.4-2.6 11.1 0s7.4 2.6 11.1 0 6.2-2.6 8.2-1.1"
      />
      <circle className="moonsea-mark__star" cx="39.2" cy="13.2" r="2.1" />
    </svg>
  );
}
