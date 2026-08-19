"""
The medicine catalog: a shared, read-only reference list of medicines.

This is deliberately separate from `medicines.Medicine`, which is one user's
personal prescription — its dose, its schedule, its start and end dates. The
catalog is the dictionary; a Medicine is a sentence someone wrote with it.

Keeping them apart means a user can rename or delete their own entry without
touching the shared list, and the catalog can grow (or be replaced with an
imported drug database) without migrating anybody's data.
"""

from django.db import models


class Form(models.TextChoices):
    TABLET = "tablet", "Tablet"
    CAPSULE = "capsule", "Capsule"
    SYRUP = "syrup", "Syrup"
    INJECTION = "injection", "Injection"
    DROPS = "drops", "Drops"
    INHALER = "inhaler", "Inhaler"
    CREAM = "cream", "Cream"
    PATCH = "patch", "Patch"
    OTHER = "other", "Other"


class CatalogMedicine(models.Model):
    """One purchasable presentation: a name, a strength and a form."""

    name = models.CharField(max_length=120, db_index=True)
    generic_name = models.CharField(max_length=120, blank=True, db_index=True)
    strength = models.CharField(max_length=60, blank=True)
    form = models.CharField(max_length=20, choices=Form.choices, default=Form.TABLET)
    category = models.CharField(max_length=80, blank=True, db_index=True)

    # Short, plain-language note shown under a suggestion: "For pain and fever."
    usage = models.CharField(max_length=200, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "strength"]
        verbose_name = "catalog medicine"
        verbose_name_plural = "catalog medicines"
        constraints = [
            models.UniqueConstraint(
                fields=["name", "strength", "form"], name="unique_catalog_presentation"
            )
        ]
        indexes = [
            # Autocomplete matches on either name, so both are indexed.
            models.Index(fields=["name", "strength"]),
            models.Index(fields=["generic_name"]),
        ]

    def __str__(self):
        return self.label

    @property
    def label(self) -> str:
        """"Paracetamol 500 mg" — what the app shows in the suggestion list."""
        return f"{self.name} {self.strength}".strip()

    @property
    def default_dosage(self) -> str:
        """A sensible prefill for the user's own dosage field."""
        unit = self.get_form_display().lower()
        if not self.strength:
            return f"1 {unit}"
        return f"1 {unit} ({self.strength})"
