export type DifferenceDisplay = {
  text: string;
  tone: "positive" | "negative" | "neutral" | "missing";
};

export const formatDifference = (value: number | null, digits: number): DifferenceDisplay => {
  if (value === null) return { text: "—", tone: "missing" };
  if (value > 0) return { text: `+${value.toFixed(digits)}`, tone: "positive" };
  if (value < 0) return { text: value.toFixed(digits), tone: "negative" };
  return { text: value.toFixed(digits), tone: "neutral" };
};
