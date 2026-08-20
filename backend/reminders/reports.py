"""
Adherence maths, server side.

The app derives the same figures on the phone (mobile/utils/insights.ts) from
the data it already holds. This module exists because two readers cannot: a
caregiver, who never has the patient's medicine list on their device, and an
exported report, which has to agree with what the caregiver was shown.

Nothing here is stored. Every figure is derived from the medicines the user
saved and the dose records the reminder wrote, so a report can never drift out
of step with the history it summarises.

Definitions, kept deliberately in one place because the whole product depends
on them meaning the same thing everywhere:

    expected   a scheduled dose: one entry in `times` on a day the course runs
    taken      answered "taken"
    late       taken, but answered more than LATE_AFTER_MINUTES after its time
               (a subset of taken, never added to it)
    skipped    answered "skipped" — a deliberate decision, not a failure
    missed     answered "missed", or unanswered more than GRACE_MINUTES past
               its time
    pending    still inside its grace period, or later today
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date as date_cls, datetime, timedelta

from django.utils import timezone

from medicines.models import Medicine

from .models import HistoryEntry

# A dose with no answer this long after its time counts as missed. Matches
# MISSED_AFTER_MINUTES in mobile/constants/theme.ts.
GRACE_MINUTES = 60

# Taken, but not on time. Short enough to be meaningful, long enough that
# answering the reminder while you fetch a glass of water isn't "late".
LATE_AFTER_MINUTES = 15

# Upper bound on the "all" range, so one very old medicine can't turn a report
# into a thousand-row scan.
MAX_DAYS = 366

RANGE_DAYS = {"week": 7, "month": 30}


@dataclass
class DayStats:
    date: str
    expected: int = 0
    taken: int = 0
    late: int = 0
    skipped: int = 0
    missed: int = 0
    pending: int = 0

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class MedicineStats:
    id: str
    name: str
    dosage: str
    color: str
    routine: str
    critical: bool
    expected: int = 0
    taken: int = 0
    late: int = 0
    skipped: int = 0
    missed: int = 0
    times: list = field(default_factory=list)

    @property
    def adherence(self):
        return round(self.taken / self.expected * 100) if self.expected else None

    def as_dict(self) -> dict:
        return {**asdict(self), "adherence": self.adherence}


# ---------------------------------------------------------------------------
# Schedule
# ---------------------------------------------------------------------------


def runs_on(medicine: Medicine, day: date_cls) -> bool:
    """True when the course covers `day`. An open-ended course never expires."""
    if medicine.start_date and day < medicine.start_date:
        return False
    if medicine.end_date and day > medicine.end_date:
        return False
    return True


def slots_on(medicines, day: date_cls):
    """Every (medicine, "HH:MM") pair scheduled on a day, earliest first."""
    out = []
    for medicine in medicines:
        if not runs_on(medicine, day):
            continue
        for time in medicine.times or []:
            out.append((medicine, str(time)[:5]))
    out.sort(key=lambda pair: pair[1])
    return out


def _minutes(hhmm: str) -> int:
    try:
        hour, minute = hhmm.split(":")[:2]
        return int(hour) * 60 + int(minute)
    except (ValueError, AttributeError):
        return 0


def _scheduled_at(day: date_cls, hhmm: str) -> datetime:
    """The dose's own moment, in the server's configured timezone."""
    naive = datetime.combine(day, datetime.min.time()) + timedelta(minutes=_minutes(hhmm))
    return timezone.make_aware(naive, timezone.get_current_timezone())


def is_late(entry: HistoryEntry) -> bool:
    """Taken, but well after the reminder. Doses without a timestamp are not."""
    if entry.status != HistoryEntry.Status.TAKEN or not entry.taken_at:
        return False
    due = _scheduled_at(entry.scheduled_date, str(entry.scheduled_time)[:5])
    return entry.taken_at - due > timedelta(minutes=LATE_AFTER_MINUTES)


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------


def range_days(range_key: str, medicines, entries) -> int:
    """How many days the named range covers, ending today."""
    if range_key in RANGE_DAYS:
        return RANGE_DAYS[range_key]
    today = timezone.localdate()
    starts = [m.start_date for m in medicines if m.start_date]
    starts += [e.scheduled_date for e in entries]
    if not starts:
        return 1
    span = (today - min(min(starts), today)).days + 1
    return max(1, min(span, MAX_DAYS))


def _entry_key(entry: HistoryEntry) -> tuple:
    return (entry.medicine_id, entry.scheduled_date, str(entry.scheduled_time)[:5])


def build_daily(medicines, entries, days: int, end_date: date_cls) -> list[DayStats]:
    """Per-day counts for the `days` days ending on `end_date`, oldest first."""
    by_slot = {_entry_key(e): e for e in entries}
    today = timezone.localdate()
    now = timezone.localtime()
    now_minutes = now.hour * 60 + now.minute

    out: list[DayStats] = []
    for offset in range(days - 1, -1, -1):
        day = end_date - timedelta(days=offset)
        stats = DayStats(date=day.isoformat())

        for medicine, time in slots_on(medicines, day):
            stats.expected += 1
            entry = by_slot.get((medicine.id, day, time))

            if entry and entry.status == HistoryEntry.Status.TAKEN:
                stats.taken += 1
                if is_late(entry):
                    stats.late += 1
            elif entry and entry.status == HistoryEntry.Status.SKIPPED:
                stats.skipped += 1
            elif entry and entry.status == HistoryEntry.Status.MISSED:
                stats.missed += 1
            elif day > today:
                stats.pending += 1
            elif day < today or now_minutes - _minutes(time) > GRACE_MINUTES:
                # Unanswered and out of time. On a past day every unanswered
                # dose is missed; today only once the grace period has run out.
                stats.missed += 1
            else:
                stats.pending += 1

        out.append(stats)
    return out


def summarize(days: list[DayStats]) -> dict:
    totals = {
        key: sum(getattr(d, key) for d in days)
        for key in ("expected", "taken", "late", "skipped", "missed", "pending")
    }
    expected = totals["expected"]
    # Skipped doses are deliberate, so they are reported but never counted as
    # taken: adherence answers "did the plan happen?", not "was there a reason?".
    totals["adherence"] = round(totals["taken"] / expected * 100) if expected else None
    totals["onTime"] = totals["taken"] - totals["late"]
    return totals


def bucketize(days: list[DayStats]) -> list[dict]:
    """
    Roll the daily series into chart columns: daily up to 10 days, then whole
    weeks, then calendar months. The same rule the app's chart uses.
    """
    if len(days) <= 10:
        return [{**d.as_dict(), "label": d.date, "days": 1} for d in days]

    groups: list[list[DayStats]] = []
    if len(days) <= 45:
        # Walk backwards so the most recent column is always a full week.
        for end in range(len(days), 0, -7):
            groups.insert(0, days[max(0, end - 7) : end])
    else:
        key = ""
        for day in days:
            month = day.date[:7]
            if month != key:
                groups.append([])
                key = month
            groups[-1].append(day)

    out = []
    for group in groups:
        rolled = {
            key: sum(getattr(d, key) for d in group)
            for key in ("expected", "taken", "late", "skipped", "missed", "pending")
        }
        out.append(
            {
                **rolled,
                "date": group[0].date,
                "label": group[0].date[:7] if len(days) > 45 else group[0].date,
                "days": len(group),
            }
        )
    return out


def per_medicine(medicines, entries, days: int, end_date: date_cls) -> list[dict]:
    """One row per medicine, so a report can say *which* one is slipping."""
    start = end_date - timedelta(days=days - 1)
    by_slot = {_entry_key(e): e for e in entries}
    today = timezone.localdate()
    now = timezone.localtime()
    now_minutes = now.hour * 60 + now.minute

    rows = []
    for medicine in medicines:
        stats = MedicineStats(
            id=str(medicine.id),
            name=medicine.name,
            dosage=medicine.dosage,
            color=medicine.color,
            routine=medicine.routine,
            critical=medicine.is_critical,
            times=[str(t)[:5] for t in (medicine.times or [])],
        )
        for offset in range(days):
            day = start + timedelta(days=offset)
            if not runs_on(medicine, day):
                continue
            for time in stats.times:
                stats.expected += 1
                entry = by_slot.get((medicine.id, day, time))
                if entry and entry.status == HistoryEntry.Status.TAKEN:
                    stats.taken += 1
                    if is_late(entry):
                        stats.late += 1
                elif entry and entry.status == HistoryEntry.Status.SKIPPED:
                    stats.skipped += 1
                elif entry and entry.status == HistoryEntry.Status.MISSED:
                    stats.missed += 1
                elif day < today or (
                    day == today and now_minutes - _minutes(time) > GRACE_MINUTES
                ):
                    stats.missed += 1
        if stats.expected:
            rows.append(stats.as_dict())

    rows.sort(key=lambda r: (r["adherence"] if r["adherence"] is not None else 101, r["name"]))
    return rows


def today_schedule(medicines, entries, day: date_cls | None = None) -> list[dict]:
    """
    A day's doses with the status each one is in right now — the same shape the
    app's own timeline renders, so a caregiver sees exactly what the patient does.
    """
    day = day or timezone.localdate()
    by_slot = {_entry_key(e): e for e in entries}
    now = timezone.localtime()
    now_minutes = now.hour * 60 + now.minute

    out = []
    for medicine, time in slots_on(medicines, day):
        entry = by_slot.get((medicine.id, day, time))
        if entry and entry.status != HistoryEntry.Status.PENDING:
            status = entry.status
        elif now_minutes < _minutes(time):
            status = "upcoming"
        elif now_minutes - _minutes(time) > GRACE_MINUTES:
            status = "missed"
        else:
            status = "due"
        out.append(
            {
                "medicineId": str(medicine.id),
                "medicineName": medicine.name,
                "dosage": medicine.dosage,
                "color": medicine.color,
                "routine": medicine.routine,
                "mealRelation": medicine.meal_relation,
                "critical": medicine.is_critical,
                "time": time,
                "date": day.isoformat(),
                "status": status,
                "late": bool(entry and is_late(entry)),
            }
        )
    return out


# ---------------------------------------------------------------------------
# The report itself
# ---------------------------------------------------------------------------


def build_report(user, range_key: str = "week") -> dict:
    """
    Everything the report screen and the caregiver view render, in one payload.

    One query for medicines and one for the dose records, then all of it in
    memory: the series is at most a year of days, and doing it in SQL would
    mean re-implementing the grace-period rule in three more places.
    """
    range_key = range_key if range_key in {"week", "month", "all"} else "week"
    medicines = list(Medicine.objects.filter(user=user))
    today = timezone.localdate()

    all_entries = list(HistoryEntry.objects.filter(user=user))
    days = range_days(range_key, medicines, all_entries)
    start = today - timedelta(days=days - 1)
    entries = [e for e in all_entries if start <= e.scheduled_date <= today]

    daily = build_daily(medicines, entries, days, today)
    summary = summarize(daily)

    # The comparison period is the same length, immediately before this one —
    # reported only when it had something scheduled to compare against.
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)
    previous_entries = [
        e for e in all_entries if previous_start <= e.scheduled_date <= previous_end
    ]
    previous = summarize(build_daily(medicines, previous_entries, days, previous_end))
    trend = None
    if summary["adherence"] is not None and previous["adherence"] is not None:
        trend = {
            "delta": summary["adherence"] - previous["adherence"],
            "days": days,
            "previous": previous["adherence"],
        }

    return {
        "range": range_key,
        "days": days,
        "from": start.isoformat(),
        "to": today.isoformat(),
        "generatedAt": timezone.now().isoformat(),
        "summary": summary,
        "trend": trend,
        "daily": [d.as_dict() for d in daily],
        "buckets": bucketize(daily),
        # Weekly and monthly series always accompany the report, so the trend
        # section never needs a second round trip to change its shape.
        "weekly": bucketize(build_daily(medicines, all_entries, 28, today)),
        "monthly": bucketize(build_daily(medicines, all_entries, 180, today)),
        "medicines": per_medicine(medicines, entries, days, today),
        "today": today_schedule(medicines, all_entries, today),
    }
