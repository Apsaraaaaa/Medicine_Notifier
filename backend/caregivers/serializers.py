from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import CaregiverAlert, CaregiverLink

User = get_user_model()


class CaregiverLinkSerializer(serializers.ModelSerializer):
    """
    A link as the *patient* sees it: someone they invited.

    `inviteCode` is only ever shown to the patient — it is what they read out
    to the caregiver — and only while the invitation is still pending.
    """

    id = serializers.CharField(read_only=True)
    caregiverEmail = serializers.EmailField(source="caregiver_email")
    caregiverName = serializers.CharField(
        source="caregiver_name", required=False, allow_blank=True
    )
    alertOnMissed = serializers.BooleanField(source="alert_on_missed", required=False)
    inviteCode = serializers.SerializerMethodField()
    displayName = serializers.CharField(source="display_name", read_only=True)
    hasAccount = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    acceptedAt = serializers.DateTimeField(source="accepted_at", read_only=True)

    class Meta:
        model = CaregiverLink
        fields = [
            "id",
            "caregiverEmail",
            "caregiverName",
            "displayName",
            "relationship",
            "status",
            "alertOnMissed",
            "inviteCode",
            "hasAccount",
            "createdAt",
            "acceptedAt",
        ]
        read_only_fields = ["status"]

    def get_inviteCode(self, obj):  # noqa: N802 — the JSON key the app reads
        return obj.invite_code if obj.status == CaregiverLink.Status.PENDING else None

    def get_hasAccount(self, obj):  # noqa: N802
        return obj.caregiver_id is not None

    def validate_caregiverEmail(self, value):  # noqa: N802
        value = value.strip().lower()
        request = self.context.get("request")
        if request and value == request.user.email.lower():
            raise serializers.ValidationError("You can't add yourself as your own caregiver.")
        return value

    def create(self, validated_data):
        patient = self.context["request"].user
        email = validated_data["caregiver_email"]
        # Re-inviting somebody already invited updates that invitation rather
        # than failing on the unique constraint — which is what the patient
        # meant, and it also un-revokes a link they changed their mind about.
        link, created = CaregiverLink.objects.get_or_create(
            patient=patient,
            caregiver_email=email,
            defaults={**validated_data, "patient": patient},
        )
        if not created:
            for field, value in validated_data.items():
                setattr(link, field, value)
            if link.status == CaregiverLink.Status.REVOKED:
                link.status = CaregiverLink.Status.PENDING
                link.caregiver = None
            link.save()
        link.attach_existing_user()
        return link


class PatientLinkSerializer(serializers.ModelSerializer):
    """The same link as the *caregiver* sees it: someone they watch over."""

    id = serializers.CharField(read_only=True)
    patientName = serializers.SerializerMethodField()
    patientEmail = serializers.EmailField(source="patient.email", read_only=True)
    unreadAlerts = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = CaregiverLink
        fields = [
            "id",
            "patientName",
            "patientEmail",
            "relationship",
            "status",
            "unreadAlerts",
            "createdAt",
        ]

    def get_patientName(self, obj):  # noqa: N802
        return obj.patient.get_full_name()

    def get_unreadAlerts(self, obj):  # noqa: N802
        return obj.alerts.filter(read_at__isnull=True).count()


class CaregiverAlertSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    linkId = serializers.CharField(source="link_id", read_only=True)
    patientName = serializers.SerializerMethodField()
    medicineName = serializers.CharField(source="medicine_name", read_only=True)
    date = serializers.DateField(source="scheduled_date", read_only=True)
    time = serializers.TimeField(source="scheduled_time", format="%H:%M", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    readAt = serializers.DateTimeField(source="read_at", read_only=True)

    class Meta:
        model = CaregiverAlert
        fields = [
            "id",
            "linkId",
            "patientName",
            "medicineName",
            "dosage",
            "date",
            "time",
            "kind",
            "message",
            "createdAt",
            "readAt",
        ]

    def get_patientName(self, obj):  # noqa: N802
        return obj.link.patient.get_full_name()


class AcceptInviteSerializer(serializers.Serializer):
    """Redeems an invite code, for a caregiver who signed up after being invited."""

    code = serializers.CharField(max_length=16)

    def validate_code(self, value):
        code = value.strip().upper()
        link = CaregiverLink.objects.filter(invite_code=code).first()
        if link is None:
            raise serializers.ValidationError("That invite code isn't recognised.")
        if link.status == CaregiverLink.Status.REVOKED:
            raise serializers.ValidationError("That invitation has been withdrawn.")
        user = self.context["request"].user
        if link.patient_id == user.pk:
            raise serializers.ValidationError("That's your own invitation.")
        if link.caregiver_id and link.caregiver_id != user.pk:
            raise serializers.ValidationError("That invitation belongs to someone else.")
        self.link = link
        return code
