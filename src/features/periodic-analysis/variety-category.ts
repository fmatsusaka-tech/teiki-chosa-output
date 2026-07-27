type VarietyCategoryDefinition = {
  category: string;
  aliases: readonly string[];
  predictionModel: string;
};

const definitions: readonly VarietyCategoryDefinition[] = [
  { category: "ゆら早生", aliases: ["ゆら早生", "ゆら"], predictionModel: "ゆら早生" },
  { category: "早生(宮川・興津 等、又は山下紅)", aliases: ["早生", "山下紅", "早生(宮川・興津など)", "早生(宮川・興津 等、又は山下紅)"], predictionModel: "興津早生" },
  { category: "田口", aliases: ["田口", "田口早生"], predictionModel: "田口早生" },
  { category: "中生(向山など)", aliases: ["中生", "中生(向山など)", "向山", "向山温州"], predictionModel: "向山温州" },
  { category: "晩生", aliases: ["晩生", "林", "林温州"], predictionModel: "林温州" },
  { category: "丹生系", aliases: ["丹生系", "丹生", "丹生温州"], predictionModel: "丹生温州" },
];

export const normalizeVarietyText = (value: string): string => value
  .normalize("NFKC")
  .replace(/[（）]/g, (character) => (character === "（" ? "(" : ")"))
  .replace(/\s+/g, " ")
  .trim();

const aliasMap = new Map(
  definitions.flatMap((definition) => definition.aliases.map((alias) => [normalizeVarietyText(alias), definition] as const)),
);

export const getVarietyCategory = (rawVariety: string | null | undefined): string | null => {
  if (!rawVariety || !normalizeVarietyText(rawVariety)) {
    return null;
  }
  const normalized = normalizeVarietyText(rawVariety);
  return aliasMap.get(normalized)?.category ?? normalized;
};

export const getPredictionModel = (varietyCategory: string): string | null =>
  definitions.find((definition) => definition.category === varietyCategory)?.predictionModel ?? null;
