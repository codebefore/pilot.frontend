import type { JobStatus } from "../types";

export type UserRole = "Patron" | "Muhasebe" | "Operasyon" | "Eğitmen";

export type AppUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  status: JobStatus;
  statusLabel: string;
  editable: boolean;
};

export const mockUsers: AppUser[] = [
  {
    id: "u1",
    fullName: "Mehmet Sezer",
    email: "mehmet@sezer.com",
    phone: "5321234567",
    role: "Patron",
    status: "success",
    statusLabel: "Aktif",
    editable: false,
  },
  {
    id: "u2",
    fullName: "Selin Yıldız",
    email: "selin@sezer.com",
    phone: "5324567890",
    role: "Muhasebe",
    status: "success",
    statusLabel: "Aktif",
    editable: true,
  },
  {
    id: "u3",
    fullName: "Ayşe Korkmaz",
    email: "ayse@sezer.com",
    phone: "5337778899",
    role: "Operasyon",
    status: "success",
    statusLabel: "Aktif",
    editable: true,
  },
  {
    id: "u4",
    fullName: "Hasan Korkmaz",
    email: "hasan@sezer.com",
    phone: "5351112233",
    role: "Eğitmen",
    status: "success",
    statusLabel: "Aktif",
    editable: true,
  },
];

export function formatPhone(raw: string): string {
  if (raw.length !== 10) return raw;
  return `0${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6, 8)} ${raw.slice(8, 10)}`;
}
