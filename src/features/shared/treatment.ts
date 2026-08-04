const blankTreatmentLabels = new Set(["無処理区", "処理区なし"]);

/** Treats blank, "無処理区", and "処理区なし" as the same absence of a treatment. */
export const normalizeTreatment = (treatment: string | null): string | null => {
  if (treatment === null) return null;
  const trimmed = treatment.trim();
  return trimmed === "" || blankTreatmentLabels.has(trimmed) ? null : treatment;
};
