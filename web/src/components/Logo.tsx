/** Capsule-and-clock mark: the product is medicine plus timing. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Medicine Notifier"
      fill="none"
    >
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      {/* capsule */}
      <rect
        x="8.5"
        y="12.5"
        width="15"
        height="7"
        rx="3.5"
        transform="rotate(-45 8.5 12.5)"
        fill="#fff"
        opacity="0.95"
      />
      <path
        d="M13.45 7.55 18.4 12.5l-5 5-4.95-4.95a3.5 3.5 0 0 1 4.95-4.95Z"
        fill="#fff"
        opacity="0.55"
      />
      {/* clock hand tick */}
      <circle cx="22" cy="22" r="5.5" fill="#fff" />
      <path
        d="M22 19.2v3l1.9 1.4"
        stroke="var(--brand)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
