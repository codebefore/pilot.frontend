import type { JobStatus } from "../types";

export type DocumentUrgency = "urgent" | "soon" | "normal";

export type MissingDocument = {
  id: string;
  candidate: string;
  missing: string;
  dueDate: string;
  urgency: DocumentUrgency;
  pillStatus: JobStatus;
  pillLabel: string;
};

export const mockMissingDocuments: MissingDocument[] = [
  {
    id: "d1",
    candidate: "Ahmet Yılmaz",
    missing: "Sağlık Raporu, Fotoğraf",
    dueDate: "08.04.2026",
    urgency: "urgent",
    pillStatus: "failed",
    pillLabel: "Acil",
  },
  {
    id: "d2",
    candidate: "Emre Şahin",
    missing: "Ehliyet Fotokopisi, Sağlık Raporu, İkametgah",
    dueDate: "09.04.2026",
    urgency: "urgent",
    pillStatus: "failed",
    pillLabel: "Acil",
  },
  {
    id: "d3",
    candidate: "Mustafa Öztürk",
    missing: "Fotoğraf",
    dueDate: "12.04.2026",
    urgency: "soon",
    pillStatus: "retry",
    pillLabel: "Yakın",
  },
  {
    id: "d4",
    candidate: "Ali Koç",
    missing: "Sağlık Raporu",
    dueDate: "18.04.2026",
    urgency: "normal",
    pillStatus: "queued",
    pillLabel: "Normal",
  },
];
