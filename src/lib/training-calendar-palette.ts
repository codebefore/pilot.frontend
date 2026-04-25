// Grup başına deterministik mat renk paleti. Orta-açık tonlar
// (L~38-42%), saturation düşük — beyaz metin okunaklı. 8 farklı ton.
// TrainingCalendar ve TrainingFilters bileşenleri aynı eşlemeyi
// kullansın diye buraya taşındı.
export const GROUP_PALETTE = [
  { bg: "#3e5660", border: "#2c4049", fg: "#ffffff" }, // mat petrol
  { bg: "#4d4470", border: "#392f5a", fg: "#ffffff" }, // mat indigo
  { bg: "#6a5062", border: "#513a4a", fg: "#ffffff" }, // mat eflatun
  { bg: "#675740", border: "#4c3f2d", fg: "#ffffff" }, // mat kahve
  { bg: "#4d6b47", border: "#385032", fg: "#ffffff" }, // mat orman
  { bg: "#5a4d6a", border: "#423850", fg: "#ffffff" }, // mat patlıcan
  { bg: "#6f4d4d", border: "#553838", fg: "#ffffff" }, // mat kiremit
  { bg: "#4d5c70", border: "#374455", fg: "#ffffff" }, // mat çelik
] as const;

export type GroupColor = (typeof GROUP_PALETTE)[number];

export const colorForGroup = (groupName: string): GroupColor => {
  let sum = 0;
  for (let i = 0; i < groupName.length; i++) {
    sum += groupName.charCodeAt(i);
  }
  return GROUP_PALETTE[sum % GROUP_PALETTE.length];
};
