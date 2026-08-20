"""
A medicine and the times of day it should be taken.

Field names mirror the app's TypeScript types (mobile/types.ts) as closely as
Python naming allows, so the serializer is a thin camelCase translation rather
than a reshaping layer:

    Medicine -> id, name, dosage, notes, startDate, endDate, frequency,
                times[], color, routine, mealRelation, critical
"""

from django.conf import settings
from django.db import models


class Routine(models.TextChoices):
    """
    The part of the day a dose belongs to.

    A routine is remembered far better than a clock time — "with breakfast"
    survives a late start, "08:00" does not — so a medicine can be organised
    around one and still keep the exact `times` the reminders fire at.
    """

    ANYTIME = "anytime", "Any time"
    BREAKFAST = "breakfast", "Breakfast"
    LUNCH = "lunch", "Lunch"
    DINNER = "dinner", "Dinner"
    BEDTIME = "bedtime", "Bedtime"


class MealRelation(models.TextChoices):
    """Where the dose sits relative to the meal its routine names."""

    NONE = "none", "No preference"
    BEFORE = "before", "Before meal"
    WITH = "with", "With meal"
    AFTER = "after", "After meal"


class Medicine(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="medicines"
    )

    # Which catalog entry this was picked from, when it was picked from one.
    # SET_NULL and a copied `name`: the catalog is reference data the user does
    # not own, so editing or retiring a catalog entry must never rewrite or
    # remove somebody's prescription.
    catalog_item = models.ForeignKey(
        "catalog.CatalogMedicine",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prescriptions",
    )

    name = models.CharField(max_length=200)
    dosage = models.CharField(max_length=100, blank=True)
    frequency = models.CharField(max_length=100, blank=True)

    # Reminder times as ["08:00", "20:00"]. PostgreSQL stores this in a native
    # jsonb column; the app's scheduler compares these strings directly.
    times = models.JSONField(default=list, blank=True)

    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    # Exposed to the app as `notes` — the wording the UI uses for it.
    instructions = models.TextField(blank=True)

    # Routine grouping. Independent of `times`: the routine says *when in the
    # day* the dose belongs, the times say when the phone rings.
    routine = models.CharField(
        max_length=16, choices=Routine.choices, default=Routine.ANYTIME
    )
    meal_relation = models.CharField(
        max_length=8, choices=MealRelation.choices, default=MealRelation.NONE
    )

    color = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True)

    # A dose that must not be quietly skipped. Only these raise an alert to a
    # caregiver, so the alerts stay worth reading.
    is_critical = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["user", "routine"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.user.email})"
