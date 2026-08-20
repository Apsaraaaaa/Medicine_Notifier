"""
Caregiver and family monitoring.

Two people, one schedule. A `CaregiverLink` is the grant: the *patient* names
someone they trust, and from then on that person may read the patient's
medicines, dose records and adherence — and only those. The link is the whole
permission model, so revoking it revokes everything in one row.

Direction matters and is easy to get backwards, so it is spelled out here:

    link.patient    the person taking the medicine — owns the data, owns the grant
    link.caregiver  the person watching over them — read-only, always

A caregiver is invited by email. If that email already has an account the link
is live immediately, because the patient granting access *is* the consent that
matters. If it does not, the link waits as PENDING with a short invite code the
caregiver redeems once they have signed up.

Alerts are raised only for medicines the patient marked critical, and only when
a dose has gone unanswered past its grace period. Anything less selective and a
caregiver learns to ignore them, which is worse than not sending any.
"""

import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone

from medicines.models import Medicine

# Characters a code is built from: no O/0 or I/1, because these get read out
# loud and typed in by someone who did not choose them.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8


def make_invite_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


class CaregiverLink(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Invited"
        ACTIVE = "active", "Active"
        REVOKED = "revoked", "Revoked"

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="caregiver_links"
    )
    # Null until the invited email belongs to an account. The email is what the
    # invitation is addressed to, and it stays put so a revoked link can still
    # be read as "you invited this person".
    caregiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="patient_links",
    )
    caregiver_email = models.EmailField()
    caregiver_name = models.CharField(max_length=150, blank=True)
    # "Daughter", "Son", "Nurse" — free text, shown next to the name.
    relationship = models.CharField(max_length=60, blank=True)

    invite_code = models.CharField(max_length=16, unique=True, default=make_invite_code)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    # Whether an unanswered critical dose raises an alert for this caregiver.
    alert_on_missed = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            # One invitation per person per patient — inviting the same email
            # twice should edit the existing link, not create a second grant.
            models.UniqueConstraint(
                fields=["patient", "caregiver_email"], name="unique_caregiver_per_patient"
            )
        ]
        indexes = [
            models.Index(fields=["caregiver", "status"]),
            models.Index(fields=["patient", "status"]),
        ]
        verbose_name = "caregiver link"

    def __str__(self):
        return f"{self.caregiver_email} watches {self.patient.email} ({self.status})"

    @property
    def display_name(self) -> str:
        if self.caregiver_name:
            return self.caregiver_name
        if self.caregiver:
            return self.caregiver.get_full_name()
        return self.caregiver_email

    def attach_existing_user(self):
        """
        Links the invitation to an account with that email, if one exists.

        Called on create and again whenever the link is read, so an invitation
        sent before the caregiver signed up goes live by itself once they do —
        without either person having to notice and retry.
        """
        if self.caregiver_id or self.status == self.Status.REVOKED:
            return False
        User = self.patient.__class__
        match = User.objects.filter(email__iexact=self.caregiver_email).first()
        if not match or match.pk == self.patient_id:
            return False
        self.caregiver = match
        self.status = self.Status.ACTIVE
        self.accepted_at = timezone.now()
        self.save(update_fields=["caregiver", "status", "accepted_at"])
        return True


class CaregiverAlert(models.Model):
    """
    One unanswered critical dose, addressed to one caregiver.

    Rows are the record of what was raised, which is what makes them safe to
    generate on demand: the unique constraint means the same dose can never
    alert the same caregiver twice, however often the check runs.
    """

    class Kind(models.TextChoices):
        MISSED = "missed", "Dose missed"
        UNCONFIRMED = "unconfirmed", "Dose not confirmed"

    link = models.ForeignKey(CaregiverLink, on_delete=models.CASCADE, related_name="alerts")
    medicine = models.ForeignKey(
        Medicine, on_delete=models.SET_NULL, null=True, blank=True, related_name="alerts"
    )

    # Snapshots, for the same reason the dose records keep them: the alert has
    # to stay readable after the medicine is renamed or deleted.
    medicine_name = models.CharField(max_length=200, blank=True)
    dosage = models.CharField(max_length=100, blank=True)

    scheduled_date = models.DateField()
    scheduled_time = models.TimeField()

    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.MISSED)
    message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-scheduled_date", "-scheduled_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["link", "medicine_name", "scheduled_date", "scheduled_time"],
                name="unique_alert_per_dose",
            )
        ]
        indexes = [models.Index(fields=["link", "read_at"])]
        verbose_name = "caregiver alert"

    def __str__(self):
        return f"{self.medicine_name} {self.scheduled_date} {self.scheduled_time}"
