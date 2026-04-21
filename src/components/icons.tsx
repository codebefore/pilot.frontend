import type { ReactElement } from "react";

type IconProps = { size?: number; stroke?: number };

const defaults = { size: 16, stroke: 2 };

const svg = (children: ReactElement | ReactElement[], p: IconProps = {}): ReactElement => {
  const { size = defaults.size, stroke = defaults.stroke } = p;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
};

export const DashboardIcon = (p?: IconProps) =>
  svg(
    [
      <rect key="1" x="3" y="3" width="7" height="7" rx="1" />,
      <rect key="2" x="14" y="3" width="7" height="7" rx="1" />,
      <rect key="3" x="3" y="14" width="7" height="7" rx="1" />,
      <rect key="4" x="14" y="14" width="7" height="7" rx="1" />,
    ],
    p
  );

export const CandidatesIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />,
      <circle key="2" cx="9" cy="7" r="4" />,
      <path key="3" d="M22 21v-2a4 4 0 0 0-3-3.87" />,
      <path key="4" d="M16 3.13a4 4 0 0 1 0 7.75" />,
    ],
    p
  );

export const GroupsIcon = (p?: IconProps) =>
  svg(
    [
      <rect key="1" x="3" y="4" width="18" height="18" rx="2" />,
      <line key="2" x1="16" y1="2" x2="16" y2="6" />,
      <line key="3" x1="8" y1="2" x2="8" y2="6" />,
      <line key="4" x1="3" y1="10" x2="21" y2="10" />,
    ],
    p
  );

export const GridIcon = (p?: IconProps) =>
  svg(
    [
      <rect key="1" x="3" y="3" width="7" height="7" rx="1" />,
      <rect key="2" x="14" y="3" width="7" height="7" rx="1" />,
      <rect key="3" x="3" y="14" width="7" height="7" rx="1" />,
      <rect key="4" x="14" y="14" width="7" height="7" rx="1" />,
    ],
    p
  );

export const ListIcon = (p?: IconProps) =>
  svg(
    [
      <line key="1" x1="8" y1="6" x2="21" y2="6" />,
      <line key="2" x1="8" y1="12" x2="21" y2="12" />,
      <line key="3" x1="8" y1="18" x2="21" y2="18" />,
      <circle key="4" cx="4" cy="6" r="1" fill="currentColor" stroke="none" />,
      <circle key="5" cx="4" cy="12" r="1" fill="currentColor" stroke="none" />,
      <circle key="6" cx="4" cy="18" r="1" fill="currentColor" stroke="none" />,
    ],
    p
  );

export const DocumentsIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
      <polyline key="2" points="14 2 14 8 20 8" />,
    ],
    p
  );

export const ExamsIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
      <polyline key="2" points="14 2 14 8 20 8" />,
      <path key="3" d="m9 13 2 2 4-4" />,
    ],
    p
  );

export const PaymentsIcon = (p?: IconProps) =>
  svg(
    [
      <line key="1" x1="12" y1="1" x2="12" y2="23" />,
      <path key="2" d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    ],
    p
  );

export const MebIcon = (p?: IconProps) =>
  svg(
    [
      <polyline key="1" points="16 18 22 12 16 6" />,
      <polyline key="2" points="8 6 2 12 8 18" />,
    ],
    p
  );

export const ChevronDownIcon = (p?: IconProps) =>
  svg(<polyline points="6 9 12 15 18 9" />, { size: 12, ...p });

export const BellIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />,
      <path key="2" d="M13.73 21a2 2 0 0 1-3.46 0" />,
    ],
    p
  );

export const AlertIcon = (p?: IconProps) =>
  svg(
    [
      <circle key="1" cx="12" cy="12" r="10" />,
      <line key="2" x1="12" y1="8" x2="12" y2="12" />,
      <line key="3" x1="12" y1="16" x2="12.01" y2="16" />,
    ],
    p
  );

export const PlusIcon = (p?: IconProps) =>
  svg(
    [
      <line key="1" x1="12" y1="5" x2="12" y2="19" />,
      <line key="2" x1="5" y1="12" x2="19" y2="12" />,
    ],
    { stroke: 2.5, ...p }
  );

export const DownloadIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />,
      <polyline key="2" points="7 10 12 15 17 10" />,
      <line key="3" x1="12" y1="15" x2="12" y2="3" />,
    ],
    p
  );

export const CalendarIcon = (p?: IconProps) =>
  svg(
    [
      <rect key="1" x="3" y="4" width="18" height="18" rx="2" />,
      <line key="2" x1="8" y1="2.5" x2="8" y2="6" />,
      <line key="3" x1="16" y1="2.5" x2="16" y2="6" />,
      <line key="4" x1="3" y1="10" x2="21" y2="10" />,
      <line key="5" x1="8" y1="14" x2="8" y2="14" />,
      <line key="6" x1="12" y1="14" x2="12" y2="14" />,
      <line key="7" x1="16" y1="14" x2="16" y2="14" />,
    ],
    p
  );

export const FilterIcon = (p?: IconProps) =>
  svg(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />, p);

export const CheckIcon = (p?: IconProps) =>
  svg(<path d="M20 6 9 17l-5-5" />, { stroke: 2.5, ...p });

export const RefreshIcon = (p?: IconProps) =>
  svg(
    [
      <polyline key="1" points="23 4 23 10 17 10" />,
      <path key="2" d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />,
    ],
    p
  );

export const KeyIcon = (p?: IconProps) =>
  svg(
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />,
    p
  );

export const UploadCloudIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />,
      <polyline key="2" points="17 8 12 3 7 8" />,
      <line key="3" x1="12" y1="3" x2="12" y2="15" />,
    ],
    p
  );

export const FileIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
      <polyline key="2" points="14 2 14 8 20 8" />,
    ],
    p
  );

export const XIcon = (p?: IconProps) =>
  svg(
    [
      <line key="1" x1="18" y1="6" x2="6" y2="18" />,
      <line key="2" x1="6" y1="6" x2="18" y2="18" />,
    ],
    p
  );

export const PencilIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />,
      <path key="2" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
    ],
    p
  );

export const MenuIcon = (p?: IconProps) =>
  svg(
    [
      <line key="1" x1="3" y1="6" x2="21" y2="6" />,
      <line key="2" x1="3" y1="12" x2="21" y2="12" />,
      <line key="3" x1="3" y1="18" x2="21" y2="18" />,
    ],
    p
  );

export const TrainingIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />,
      <path key="2" d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />,
    ],
    p
  );

export const SettingsIcon = (p?: IconProps) =>
  svg(
    [
      <circle key="1" cx="12" cy="12" r="3" />,
      <path
        key="2"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      />,
    ],
    p
  );

export const UsersIcon = (p?: IconProps) =>
  svg(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />, p);

export const LoginIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />,
      <polyline key="2" points="10 17 15 12 10 7" />,
      <line key="3" x1="15" y1="12" x2="3" y2="12" />,
    ],
    p
  );

export const WhatsAppIcon = (p?: IconProps) => {
  const { size = defaults.size } = p ?? {};
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.25a8.75 8.75 0 0 1 7.52 13.23A8.75 8.75 0 0 1 8.7 20.04L4 20.75l1.12-4.44A8.75 8.75 0 0 1 12 3.25Z" />
      <path d="M9.45 8.85c.14-.31.3-.35.54-.35.16 0 .33 0 .5.01.14.01.33.05.5.4.17.36.58 1.42.63 1.52.05.11.08.24 0 .38-.08.14-.13.22-.25.35-.12.12-.25.27-.35.36-.11.1-.22.2-.1.41.12.22.55.91 1.17 1.48.8.72 1.47.95 1.68 1.05.21.1.33.08.45-.05.12-.13.51-.58.65-.78.13-.19.27-.16.45-.1.18.07 1.16.55 1.36.65.2.1.33.15.38.24.05.09.05.52-.12 1.02-.17.5-.98.97-1.36 1.02-.36.05-.8.08-1.3-.07-.31-.09-.69-.22-1.19-.44-2.09-.91-3.45-3.07-3.55-3.21-.11-.15-.85-1.14-.85-2.17 0-1.03.54-1.53.73-1.74Z" />
    </svg>
  );
};

export const LogoutIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />,
      <polyline key="2" points="16 17 21 12 16 7" />,
      <line key="3" x1="21" y1="12" x2="9" y2="12" />,
    ],
    p
  );

export const UserIcon = (p?: IconProps) =>
  svg(
    [
      <path key="1" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />,
      <circle key="2" cx="12" cy="7" r="4" />,
    ],
    p
  );
