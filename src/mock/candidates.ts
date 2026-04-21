import type { JobStatus } from "../types";

export type CandidateClass = "B" | "A2" | "C";

export type Candidate = {
  id: string;
  fullName: string;
  tc: string;
  className: CandidateClass;
  term: string;
  docsDone: number;
  docsTotal: number;
  balance: number;
  mebStatus: JobStatus;
};

export const mockCandidates: Candidate[] = [
  {
    id: "c1",
    fullName: "Ahmet Yılmaz",
    tc: "12345678901",
    className: "B",
    term: "NİSAN 2026",
    docsDone: 3,
    docsTotal: 5,
    balance: -2400,
    mebStatus: "failed",
  },
  {
    id: "c2",
    fullName: "Fatma Demir",
    tc: "98765432109",
    className: "B",
    term: "NİSAN 2026",
    docsDone: 5,
    docsTotal: 5,
    balance: 0,
    mebStatus: "running",
  },
  {
    id: "c3",
    fullName: "Emre Şahin",
    tc: "55512378900",
    className: "B",
    term: "NİSAN 2026",
    docsDone: 2,
    docsTotal: 5,
    balance: -4800,
    mebStatus: "queued",
  },
  {
    id: "c4",
    fullName: "Zeynep Kara",
    tc: "33344455566",
    className: "A2",
    term: "MART 2026",
    docsDone: 5,
    docsTotal: 5,
    balance: 0,
    mebStatus: "success",
  },
  {
    id: "c5",
    fullName: "Mustafa Öztürk",
    tc: "11122233344",
    className: "C",
    term: "NİSAN 2026",
    docsDone: 4,
    docsTotal: 5,
    balance: -1200,
    mebStatus: "success",
  },
  {
    id: "c6",
    fullName: "Ayşe Yıldırım",
    tc: "66677788899",
    className: "B",
    term: "NİSAN 2026",
    docsDone: 5,
    docsTotal: 5,
    balance: 0,
    mebStatus: "success",
  },
  {
    id: "c7",
    fullName: "Hüseyin Çelik",
    tc: "44455566677",
    className: "B",
    term: "MART 2026",
    docsDone: 5,
    docsTotal: 5,
    balance: 0,
    mebStatus: "success",
  },
];

const balanceFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 0,
});

export function formatBalance(tl: number): string {
  return `${balanceFormatter.format(tl)} TL`;
}
