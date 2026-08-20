"""
Raising caregiver alerts.

There is no scheduler in this project and adding one would be a second moving
part to keep alive, so alerts are generated on demand: whenever anybody reads
the caregiver endpoints, the last few days of critical doses are re-checked and
anything unanswered past its grace period is recorded.

That is safe to repeat because `CaregiverAlert` carries a unique constraint on
(link, medicine, dose) — running the check a hundred times raises each alert
exactly once. It is also enough: a caregiver only ever learns about an alert by
opening the app, which is the moment the check runs.
"""

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from medicines.models import Medicine
from reminders.models import HistoryEntry
from reminders.reports import GRACE_MINUTES, runs_on

from .models import CaregiverAlert, CaregiverLink

# How far back a check looks. A caregiver who opens the app after a weekend
# away should still see what happened; anything older is history, not an alert.
LOOKBACK_DAYS = 3

# Alert wording, per language. Short sentences: this is read on a lock screen.
MESSAGES = {
    "en": {
        "missed": "{patient} has not confirmed {medicine} ({dosage}), due at {time} on {date}.",
        "missed_today": "{patient} has not confirmed {medicine} ({dosage}), due at {time} today.",
        "title": "Missed dose",
    },
    "ne": {
        "missed": "{patient} ले {date} को {time} बजेको {medicine} ({dosage}) पुष्टि गर्नुभएको छैन।",
        "missed_today": "{patient} ले आजको {time} बजेको {medicine} ({dosage}) पुष्टि गर्नुभएको छैन।",
        "title": "छुटेको मात्रा",
    },
}


def _minutes(hhmm: str) -> int:
    try:
        hour, minute = str(hhmm).split(":")[:2]
        return int(hour) * 60 + int(minute)
    except (ValueError, AttributeError):
        return 0


def _format_time(hhmm: str) -> str:
    """"08:00" -> "8:00 AM", matching how the app writes a dose time."""
    minutes = _minutes(hhmm)
    hour, minute = divmod(minutes, 60)
    suffix = "AM" if hour < 12 else "PM"
    display = hour % 12 or 12
    return f"{display}:{minute:02d} {suffix}"


def compose_message(link: CaregiverLink, medicine, day, time: str) -> str:
    language = "ne" if (link.caregiver and link.caregiver.language == "ne") else "en"
    strings = MESSAGES.get(language, MESSAGES["en"])
    key = "missed_today" if day == timezone.localdate() else "missed"
    return strings[key].format(
        patient=link.patient.get_full_name(),
        medicine=medicine.name,
        dosage=medicine.dosage or "—",
        time=_format_time(time),
        date=day.isoformat(),
    )


def unconfirmed_doses(patient, lookback_days: int = LOOKBACK_DAYS):
    """
    Critical doses in the recent past that nobody answered.

    "Nobody answered" means no dose record at all, or one still marked pending —
    a dose the patient explicitly skipped is a decision, not an alert.
    """
    today = timezone.localdate()
    start = today - timedelta(days=lookback_days - 1)
    now = timezone.localtime()
    now_minutes = now.hour * 60 + now.minute

    medicines = list(Medicine.objects.filter(user=patient, is_critical=True, is_active=True))
    if not medicines:
        return []

    answered = {
        (entry.medicine_id, entry.scheduled_date, str(entry.scheduled_time)[:5])
        for entry in HistoryEntry.objects.filter(
            user=patient, scheduled_date__gte=start
        ).exclude(status=HistoryEntry.Status.PENDING)
    }

    out = []
    for offset in range((today - start).days + 1):
        day = start + timedelta(days=offset)
        for medicine in medicines:
            if not runs_on(medicine, day):
                continue
            for raw in medicine.times or []:
                time = str(raw)[:5]
                if (medicine.id, day, time) in answered:
                    continue
                # Today's doses are only overdue once their grace period has
                # run out; a dose still ringing is not yet a missed one.
                if day == today and now_minutes - _minutes(time) <= GRACE_MINUTES:
                    continue
                out.append((medicine, day, time))
    return out


def refresh_alerts(patient) -> int:
    """
    Records an alert for every unanswered critical dose, for every caregiver
    watching this patient. Returns how many were newly raised.
    """
    links = list(
        CaregiverLink.objects.filter(
            patient=patient, status=CaregiverLink.Status.ACTIVE, alert_on_missed=True
        ).select_related("caregiver", "patient")
    )
    if not links:
        return 0

    raised = 0
    for medicine, day, time in unconfirmed_doses(patient):
        for link in links:
            try:
                # Its own transaction: a duplicate must not poison the caller's.
                with transaction.atomic():
                    CaregiverAlert.objects.create(
                        link=link,
                        medicine=medicine,
                        medicine_name=medicine.name,
                        dosage=medicine.dosage,
                        scheduled_date=day,
                        scheduled_time=time,
                        kind=CaregiverAlert.Kind.MISSED,
                        message=compose_message(link, medicine, day, time),
                    )
                raised += 1
            except IntegrityError:
                # Already raised for this dose — exactly what the constraint is
                # there for, and the reason this function is safe to re-run.
                pass
    return raised


def refresh_for_caregiver(caregiver) -> int:
    """Re-checks every patient this caregiver watches, before their app reads."""
    links = CaregiverLink.objects.filter(
        caregiver=caregiver, status=CaregiverLink.Status.ACTIVE
    ).select_related("patient")
    return sum(refresh_alerts(link.patient) for link in links)
