// Page copy kept in one place so the same wording is reused across pages.
import type { IconName } from "./components/icons";

export interface Feature {
  title: string;
  body: string;
  icon: IconName;
  tone: "brand" | "care";
}

export const FEATURES: Feature[] = [
  {
    title: "Medicine Reminders",
    body: "Add a medicine once with its dose and times, and a reminder arrives at every scheduled time.",
    icon: "clock",
    tone: "brand",
  },
  {
    title: "Alarm Notifications",
    body: "An alarm sounds along with the on-screen reminder, at a volume you choose, so it's hard to miss.",
    icon: "bell",
    tone: "care",
  },
  {
    title: "Snooze Reminder",
    body: "Not next to a glass of water? Snooze the dose and it asks again fifteen minutes later.",
    icon: "snooze",
    tone: "brand",
  },
  {
    title: "Mark as Taken",
    body: "One tap records the dose with the time you answered, and your consistency updates straight away.",
    icon: "check",
    tone: "care",
  },
  {
    title: "Missed Medicine Tracking",
    body: "A dose left unanswered for an hour is recorded as missed, so gaps are visible instead of forgotten.",
    icon: "alert",
    tone: "brand",
  },
  {
    title: "Medicine History",
    body: "Every taken, skipped and missed dose is grouped by day, with consistency over the week or month.",
    icon: "chart",
    tone: "care",
  },
  {
    title: "Easy Medicine Management",
    body: "Edit a dose, change reminder times or stop a course at any point — the schedule updates with it.",
    icon: "pill",
    tone: "brand",
  },
];

export interface Step {
  title: string;
  body: string;
}

export const STEPS: Step[] = [
  {
    title: "Create an account",
    body: "Sign up with your name, email and a password. The same account works on the website and the mobile app.",
  },
  {
    title: "Add your medicine",
    body: "Enter the medicine name, the dose you take, and how long the course runs.",
  },
  {
    title: "Set your reminder",
    body: "Choose how often you take it and the exact times. Add as many reminder times as a day needs.",
  },
  {
    title: "Get notified and mark it taken",
    body: "When a dose is due the reminder appears with an alarm. Answer it with taken, skipped, or snooze.",
  },
];
