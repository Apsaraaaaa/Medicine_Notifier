/**
 * Where a dose sits relative to a meal.
 *
 * The only thing a medicine says about food. It is optional — most medicines
 * name nothing, and callers are expected to leave the line out entirely rather
 * than print "No preference".
 */

import type { TranslationKey, Translator } from "../i18n";
import type { MealRelation, Medicine } from "../types";

export function mealOf(medicine: Medicine): MealRelation {
  return medicine.mealRelation ?? "none";
}

/** "After meal", or an empty string when the medicine names no preference. */
export function mealSummary(medicine: Medicine, t: Translator): string {
  const meal = mealOf(medicine);
  return meal === "none" ? "" : t(`meal.${meal}` as TranslationKey);
}
