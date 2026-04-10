export type InstitutionType = "MTSK" | "İş Mak." | "SRC" | "Psikoteknik";

export type Institution = {
  id: string;
  name: string;
  type: InstitutionType;
};

export const mockInstitutions: Institution[] = [
  { id: "i1", name: "Sezer Sürücü Kursu",  type: "MTSK" },
  { id: "i2", name: "Sezer İş Makinesi",   type: "İş Mak." },
  { id: "i3", name: "Sezer SRC Eğitim",    type: "SRC" },
];
