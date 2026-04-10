import type { JobStatus } from "../types";

export type Group = {
  id: string;
  name: string;
  status: JobStatus;
  statusLabel: string;
  capacityFilled: number;
  capacityTotal: number;
  startDate: string;
  endDate: string;
  mebStatus: JobStatus;
  mebStatusLabel: string;
  canAddCandidate: boolean;
};

export const mockGroups: Group[] = [
  {
    id: "g1",
    name: "B Sınıfı — Nisan 2026",
    status: "running",
    statusLabel: "Aktif",
    capacityFilled: 20,
    capacityTotal: 24,
    startDate: "01.04.2026",
    endDate: "30.05.2026",
    mebStatus: "success",
    mebStatusLabel: "Oluşturuldu",
    canAddCandidate: true,
  },
  {
    id: "g2",
    name: "A2 Sınıfı — Nisan 2026",
    status: "running",
    statusLabel: "Aktif",
    capacityFilled: 8,
    capacityTotal: 12,
    startDate: "01.04.2026",
    endDate: "15.05.2026",
    mebStatus: "success",
    mebStatusLabel: "Oluşturuldu",
    canAddCandidate: true,
  },
  {
    id: "g3",
    name: "B Sınıfı — Mart 2026",
    status: "manual",
    statusLabel: "Kapanışta",
    capacityFilled: 22,
    capacityTotal: 24,
    startDate: "01.03.2026",
    endDate: "15.04.2026",
    mebStatus: "manual",
    mebStatusLabel: "Manuel Onay",
    canAddCandidate: false,
  },
  {
    id: "g4",
    name: "C Sınıfı — Mart 2026",
    status: "success",
    statusLabel: "Tamamlandı",
    capacityFilled: 10,
    capacityTotal: 10,
    startDate: "15.02.2026",
    endDate: "31.03.2026",
    mebStatus: "success",
    mebStatusLabel: "Kapandı",
    canAddCandidate: false,
  },
];
