export const GROUP_NUMBER_VALUES = ["1", "2", "3", "4", "5"] as const;

export const GROUP_BRANCH_VALUES = Array.from({ length: 26 }, (_, index) =>
  String.fromCharCode(65 + index)
);

export type GroupCodeParts = {
  groupNumber: string;
  groupBranch: string;
};

export function buildGroupCode(groupNumber: string, groupBranch: string): string {
  return `${groupNumber.trim()}${groupBranch.trim().toUpperCase()}`;
}

export function buildGroupTitle(groupNumber: string, groupBranch: string): string {
  return buildGroupCode(groupNumber, groupBranch);
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
