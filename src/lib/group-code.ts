export const GROUP_NUMBER_VALUES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export const GROUP_BRANCH_VALUES = Array.from({ length: 8 }, (_, index) =>
  String.fromCharCode(65 + index)
);

export type GroupCodeParts = {
  groupNumber: string;
  groupBranch: string;
};

export function buildGroupCode(groupNumber: string, groupBranch: string): string {
  return `${groupNumber.trim()}${groupBranch.trim().toUpperCase()}`;
}

function normalizeGroupNumber(groupNumber: unknown): string | null {
  const normalized =
    typeof groupNumber === "number" && Number.isInteger(groupNumber)
      ? String(groupNumber)
      : typeof groupNumber === "string"
        ? groupNumber.trim()
        : null;
  if (!normalized) return null;
  return GROUP_NUMBER_VALUES.includes(normalized as (typeof GROUP_NUMBER_VALUES)[number])
    ? normalized
    : null;
}

function normalizeGroupBranch(groupBranch: unknown): string | null {
  if (typeof groupBranch !== "string") return null;
  const normalized = groupBranch.trim().toUpperCase();
  return GROUP_BRANCH_VALUES.includes(normalized) ? normalized : null;
}

export function isValidGroupCodeParts(groupNumber: unknown, groupBranch: unknown): boolean {
  return normalizeGroupNumber(groupNumber) !== null && normalizeGroupBranch(groupBranch) !== null;
}

export function resolveGroupCodeParts(input: {
  groupNumber?: unknown;
  groupBranch?: unknown;
  title?: string | null;
}): GroupCodeParts | null {
  const groupNumber = normalizeGroupNumber(input.groupNumber);
  const groupBranch = normalizeGroupBranch(input.groupBranch);
  if (groupNumber && groupBranch) {
    return { groupNumber, groupBranch };
  }

  const parsed = input.title ? parseGroupTitle(input.title) : null;
  if (!parsed) return null;

  const parsedGroupNumber = normalizeGroupNumber(parsed.groupNumber);
  const parsedGroupBranch = normalizeGroupBranch(parsed.groupBranch);
  if (!parsedGroupNumber || !parsedGroupBranch) return null;

  return {
    groupNumber: parsedGroupNumber,
    groupBranch: parsedGroupBranch,
  };
}

export function parseGroupTitle(title: string): GroupCodeParts | null {
  const normalizedTitle = title.trim();
  const match =
    normalizedTitle.match(/(?:^|[-\s])(\d+)\s*([A-Za-z])\s*$/) ??
    normalizedTitle.match(/^(\d+)\s*([A-Za-z])(?:\s*$|\s*[-—]\s*.+$)/);
  if (!match) return null;

  return {
    groupNumber: match[1],
    groupBranch: match[2].toUpperCase(),
  };
}

export function suggestNextGroupBranch(titles: string[], groupNumber: string): string {
  const usedBranches = new Set(
    titles
      .map((title) => parseGroupTitle(title))
      .filter((value): value is GroupCodeParts => value !== null && value.groupNumber === groupNumber)
      .map((value) => value.groupBranch)
  );

  return GROUP_BRANCH_VALUES.find((value) => !usedBranches.has(value)) ?? GROUP_BRANCH_VALUES[0];
}

export function suggestNextGroupCodeParts(titles: string[]): GroupCodeParts {
  const usedCodes = new Set(
    titles
      .map((title) => parseGroupTitle(title))
      .filter((value): value is GroupCodeParts => value !== null)
      .map((value) => buildGroupCode(value.groupNumber, value.groupBranch))
  );

  for (const groupNumber of GROUP_NUMBER_VALUES) {
    for (const groupBranch of GROUP_BRANCH_VALUES) {
      if (!usedCodes.has(buildGroupCode(groupNumber, groupBranch))) {
        return { groupNumber, groupBranch };
      }
    }
  }

  return {
    groupNumber: GROUP_NUMBER_VALUES[0],
    groupBranch: GROUP_BRANCH_VALUES[0],
  };
}
