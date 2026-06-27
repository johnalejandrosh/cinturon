import type { SVGProps } from "react";

/** Minimal stroke icon set (no icon-library dependency). */

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type P = SVGProps<SVGSVGElement>;

export const OrbitIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="2.5" />
    <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-20 12 12)" />
    <circle cx="3.5" cy="9.5" r="1" fill="currentColor" />
  </svg>
);

export const RulerIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 8.5 8.5 3l12.5 12.5L15.5 21z" />
    <path d="M7 7l1.5 1.5M10 10l1.5 1.5M13 13l1.5 1.5" />
  </svg>
);

export const WeightIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="6" r="2.5" />
    <path d="M5 21 7 9h10l2 12z" />
  </svg>
);

export const GaugeIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 14 16 9" />
    <path d="M3.5 18a9 9 0 1 1 17 0" />
    <circle cx="12" cy="14" r="1" fill="currentColor" />
  </svg>
);

export const AlertIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3 22 20H2z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </svg>
);

export const TargetIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export const DiceIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="15" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
    <circle cx="9" cy="15" r="1" fill="currentColor" />
  </svg>
);

export const PlayIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" />
  </svg>
);

export const PauseIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

export const ResetIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v4h4" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const ChevronIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const InfoIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <circle cx="12" cy="7.8" r="0.7" fill="currentColor" />
  </svg>
);

export const ExpandIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

export const MinimizeIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
    <path d="M16 3v3a2 2 0 0 0 2 2h3" />
    <path d="M8 21v-3a2 2 0 0 0-2-2H3" />
    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
  </svg>
);
