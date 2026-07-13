export const DRIVING_EXAM_TIME_SLOTS = [
  { value: "08:30", label: "08:30 - 09:10" },
  { value: "09:15", label: "09:15 - 09:55" },
  { value: "10:00", label: "10:00 - 10:40" },
  { value: "10:45", label: "10:45 - 11:25" },
  { value: "11:30", label: "11:30 - 12:10" },
  { value: "12:15", label: "12:15 - 12:55" },
  { value: "13:00", label: "13:00 - 13:40" },
  { value: "13:45", label: "13:45 - 14:25" },
  { value: "14:30", label: "14:30 - 15:10" },
  { value: "15:15", label: "15:15 - 15:55" },
  { value: "16:00", label: "16:00 - 16:40" },
  { value: "16:45", label: "16:45 - 17:25" },
];

export const DEFAULT_DRIVING_EXAM_TIME = DRIVING_EXAM_TIME_SLOTS[0]?.value ?? "08:30";

export const DRIVING_EXAM_TIME_SLOT_LABELS = new Map(
  DRIVING_EXAM_TIME_SLOTS.map((slot) => [slot.value, slot.label])
);
