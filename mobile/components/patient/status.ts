import type { DoseState } from "../../constants/theme";
import type { IconName } from "../ui";

/**
 * The icon each dose status is drawn with in Patient Mode.
 *
 * Deliberately more literal than the icons the full UI uses: a tick for taken,
 * a bell for one that is ringing, a clock for one pushed back, a cross for one
 * that was missed. Status is never colour alone anywhere in this app, and here
 * it is never icon alone either — every one of these is shown with its word.
 */
export const PATIENT_STATUS_ICON: Record<DoseState, IconName> = {
  taken: "check-circle",
  due: "notifications-active",
  upcoming: "schedule",
  skipped: "remove-circle",
  missed: "cancel",
  snoozed: "snooze",
};
