export type TrainingPlan = {
  id: string;
  type: "teorik" | "uygulama";
  title: string;
  instructor: string;
  vehicle?: string;
  totalHours: string;
  assigned: string;
  progress?: number; // 0..100
};

export const mockTrainingPlans: TrainingPlan[] = [
  {
    id: "tp1",
    type: "teorik",
    title: "Teorik Eğitim — B Sınıfı",
    instructor: "Hasan Korkmaz",
    totalHours: "32 saat",
    assigned: "12 / 20",
    progress: 45,
  },
  {
    id: "tp2",
    type: "uygulama",
    title: "Uygulama — B Sınıfı",
    instructor: "Kemal Aydın",
    vehicle: "34 ABC 123 — Fiat Egea",
    totalHours: "16 saat / aday",
    assigned: "12 / 20",
  },
];
