// No single Unicode emoji renders a plain closed eye (as opposed to a
// slashed-eye "off" icon or a whole sleeping/relieved face) — this is the
// standard "eye-closed" glyph design (a curved eyelid + lash ticks, no
// slash) used by several icon sets, sized to sit inline with text/emoji.
export function ClosedEyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: "inline", verticalAlign: "-0.125em" }}
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6" />
      <line x1="5" y1="16" x2="4" y2="18" />
      <line x1="12" y1="17.5" x2="12" y2="19.5" />
      <line x1="19" y1="16" x2="20" y2="18" />
    </svg>
  );
}
