/* eslint-disable @next/next/no-img-element */
// The Yancey logo, with white lettering in dark mode.
export default function Logo({ className = "w-32", dark = false }: { className?: string; dark?: boolean }) {
  if (dark) {
    return <img src="/brand/yancey-logo-dark.png" alt="Yancey Home Improvements" width={249} height={146} className={`h-auto ${className}`} />;
  }
  return (
    <span className={`block ${className}`}>
      <img src="/brand/yancey-logo.png" alt="Yancey Home Improvements" width={249} height={146} className="logo-light h-auto w-full" />
      <img src="/brand/yancey-logo-dark.png" alt="Yancey Home Improvements" width={249} height={146} className="logo-dark h-auto w-full" />
    </span>
  );
}
