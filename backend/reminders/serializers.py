from django.utils import timezone
from rest_framework import serializers

from medicines.models import Medicine

from .models import HistoryEntry


class HistoryEntrySerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    # pk_field renders the FK as a string to match `medicineId: string` in TS.
    medicineId = serializers.PrimaryKeyRelatedField(
        source="medicine",
        queryset=Medicine.objects.all(),
        pk_field=serializers.CharField(),
        required=False,
        allow_null=True,
    )
    medicineName = serializers.CharField(source="medicine_name", required=False, allow_blank=True)
    time = serializers.TimeField(
        source="scheduled_time", format="%H:%M", input_formats=["%H:%M", "%H:%M:%S"]
    )
    date = serializers.DateField(source="scheduled_date")
    recordedAt = serializers.DateTimeField(source="taken_at", required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = HistoryEntry
        fields = [
            "id",
            "medicineId",
            "medicineName",
            "dosage",
            "time",
            "date",
            "status",
            "recordedAt",
            "note",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Ownership guard: a user may only file a dose against their own
        # medicines, so the FK choices are scoped to the requesting user.
        request = self.context.get("request")
        if request is not None and request.user and request.user.is_authenticated:
            self.fields["medicineId"].queryset = Medicine.objects.filter(user=request.user)

    def validate(self, attrs):
        medicine = attrs.get("medicine")
        # Fill the display snapshot from the medicine when the client omits it.
        if medicine is not None:
            if not attrs.get("medicine_name"):
                attrs["medicine_name"] = medicine.name
            if not attrs.get("dosage"):
                attrs["dosage"] = medicine.dosage
        if not attrs.get("medicine_name") and not self.instance:
            raise serializers.ValidationError(
                {"medicineName": "Provide medicineId or medicineName."}
            )
        # A resolved dose always carries a timestamp, even if the client
        # didn't send one.
        status = attrs.get("status", getattr(self.instance, "status", None))
        if status and status != HistoryEntry.Status.PENDING:
            if not attrs.get("taken_at") and not getattr(self.instance, "taken_at", None):
                attrs["taken_at"] = timezone.now()
        return attrs
