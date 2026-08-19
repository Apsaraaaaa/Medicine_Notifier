import re

from rest_framework import serializers

from catalog.models import CatalogMedicine

from .models import Medicine

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class TimesField(serializers.ListField):
    """The `times` array: a list of "HH:MM" 24-hour strings."""

    child = serializers.CharField()

    def to_internal_value(self, data):
        values = super().to_internal_value(data)
        cleaned = []
        for raw in values:
            value = raw.strip()
            # Accept "8:00" and "08:00:00" but always store "HH:MM".
            if re.fullmatch(r"\d:[0-5]\d", value):
                value = f"0{value}"
            if re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d:[0-5]\d", value):
                value = value[:5]
            if not TIME_RE.fullmatch(value):
                raise serializers.ValidationError(
                    f'"{raw}" is not a valid time. Use 24-hour HH:MM, e.g. "08:00".'
                )
            cleaned.append(value)
        # Stable, de-duplicated order keeps the app's scheduler predictable.
        return sorted(dict.fromkeys(cleaned))


class MedicineSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    notes = serializers.CharField(
        source="instructions", required=False, allow_blank=True, default=""
    )
    startDate = serializers.DateField(source="start_date")
    endDate = serializers.DateField(source="end_date", required=False, allow_null=True)
    times = TimesField(required=False)
    active = serializers.BooleanField(source="is_active", required=False)
    # Optional: set when the user picked this from the catalog rather than
    # typing a name freehand. Nothing downstream depends on it being present.
    catalogId = serializers.PrimaryKeyRelatedField(
        source="catalog_item",
        queryset=CatalogMedicine.objects.filter(is_active=True),
        pk_field=serializers.CharField(),
        required=False,
        allow_null=True,
    )
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Medicine
        fields = [
            "id",
            "name",
            "dosage",
            "notes",
            "frequency",
            "times",
            "startDate",
            "endDate",
            "color",
            "active",
            "catalogId",
            "createdAt",
            "updatedAt",
        ]

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError(
                {"endDate": "The end date cannot be before the start date."}
            )
        return attrs
