/**
 * Small stroke icon set, drawn inline so there is no icon font or CDN request.
 * All icons inherit `currentColor` and share a 24px grid.
 */
type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="24" height="24">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="24" height="24">
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z" />
      <path d="M10.2 18.5a2 2 0 0 0 3.6 0" />
    </svg>
  );
}

export function SnoozeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="24" height="24">
      <circle cx="12" cy="13" r="7.5" />
      <path d="M10 10.5h4l-4 5h4M4.5 5.5l3-2M19.5 5.5l-3-2" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="24" height="24">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.5 2.4 4.5-4.8" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="24" height="24">
      <path d="M12 4.8 3.8 19h16.4L12 4.8Z" />
      <path d="M12 10v3.6M12 16.4h.01" />
    </svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="24" height="24">
      <path d="M4 19.5h16" />
      <path d="M7 19.5v-6M12 19.5V7M17 19.5v-9" />
    </svg>
  );
}

export function PillIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="24" height="24">
      <rect x="2.8" y="8.6" width="18.4" height="6.8" rx="3.4" transform="rotate(-45 2.8 8.6)" />
      <path d="m10 6.6 7.4 7.4" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="24" height="24">
      <circle cx="12" cy="9" r="3.6" />
      <path d="M5.5 19.2a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="24" height="24">
      <circle cx="9.5" cy="9" r="3.2" />
      <path d="M3.8 19a5.8 5.8 0 0 1 11.4 0" />
      <path d="M16 6.4a3.2 3.2 0 0 1 0 5.2M17.5 19a5.8 5.8 0 0 0-1.7-4.1" />
    </svg>
  );
}

export function StethoscopeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="24" height="24">
      <path d="M6 4v5a4 4 0 0 0 8 0V4" />
      <path d="M4.6 4h2.8M12.6 4h2.8" />
      <path d="M10 13v2.2a4 4 0 0 0 8 0V14" />
      <circle cx="18" cy="12.4" r="1.9" />
    </svg>
  );
}

export const ICONS = {
  clock: ClockIcon,
  bell: BellIcon,
  snooze: SnoozeIcon,
  check: CheckIcon,
  alert: AlertIcon,
  chart: ChartIcon,
  pill: PillIcon,
  user: UserIcon,
  users: UsersIcon,
  stethoscope: StethoscopeIcon,
};

export type IconName = keyof typeof ICONS;
