"""
What actually happened at each scheduled dose.

The app schedules reminders on the phone from the medicine's `times`; this app
stores the answer the user gave to each one, which is what adherence is
calculated from. Mirrors mobile/types.ts:

    HistoryEntry -> id, medicineId, medicineName, dosage, time, date, status,
                    recordedAt, note
"""

from django.conf import settings
from django.db import models

from medicines.models import Medicine


class HistoryEntry(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        TAKEN = "taken", "Taken"
        MISSED = "missed", "Missed"
        SKIPPED = "skipped", "Skipped"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="history"
    )
    # SET_NULL so deleting a medicine does not erase the adherence record.
    medicine = models.ForeignKey(
        Medicine, on_delete=models.SET_NULL, null=True, blank=True, related_name="history"
    )

    # Snapshots taken at write time so history stays readable after the
    # medicine is renamed or deleted.
    medicine_name = models.CharField(max_length=200, blank=True)
    dosage = models.CharField(max_length=100, blank=True)

    scheduled_date = models.DateField()
    scheduled_time = models.TimeField()

    # When the dose was actually recorded (taken/missed/skipped). Null while pending.
    taken_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_date", "-scheduled_time", "-id"]
        indexes = [
            models.Index(fields=["user", "-scheduled_date"]),
            models.Index(fields=["user", "status"]),
        ]
        verbose_name = "dose record"
        verbose_name_plural = "dose records"

    def __str__(self):
        return f"{self.medicine_name} {self.scheduled_date} {self.scheduled_time} - {self.status}"
