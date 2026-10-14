// Simple 24px stroke icons. They inherit colour from currentColor.
function Icon({ children, size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const ScanIcon = (p) => (
  <Icon {...p}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <path d="M4 12h16" />
  </Icon>
);

export const VehicleIcon = (p) => (
  <Icon {...p}>
    <path d="M5 16V11l2-5h10l2 5v5" />
    <path d="M3 16h18v2H3zM5 11h14" />
    <circle cx="7.5" cy="18.5" r="1.5" />
    <circle cx="16.5" cy="18.5" r="1.5" />
  </Icon>
);

export const WarningIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3 2 20h20L12 3z" />
    <path d="M12 10v4M12 17h.01" />
  </Icon>
);

export const HistoryIcon = (p) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M12 7v5l3 2" />
  </Icon>
);

export const EvidenceIcon = (p) => (
  <Icon {...p}>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Icon>
);

export const UsersIcon = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
  </Icon>
);

export const RoadIcon = (p) => (
  <Icon {...p}>
    <path d="M8 3 4 21M16 3l4 18M12 4v3M12 11v3M12 18v2" />
  </Icon>
);

export const ActivityIcon = (p) => (
  <Icon {...p}>
    <path d="M9 5h11M9 12h11M9 19h11" />
    <path d="M4 5h.01M4 12h.01M4 19h.01" />
  </Icon>
);

export const SignOutIcon = (p) => (
  <Icon {...p}>
    <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" />
    <path d="M15 8l4 4-4 4M19 12H9" />
  </Icon>
);
