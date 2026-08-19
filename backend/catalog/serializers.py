from rest_framework import serializers

from .models import CatalogMedicine


class CatalogMedicineSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    # `label` is what the suggestion row shows; `defaultDosage` prefills the
    # user's own dosage field when they pick a suggestion.
    label = serializers.CharField(read_only=True)
    defaultDosage = serializers.CharField(source="default_dosage", read_only=True)
    genericName = serializers.CharField(source="generic_name", read_only=True)
    formLabel = serializers.CharField(source="get_form_display", read_only=True)

    class Meta:
        model = CatalogMedicine
        fields = [
            "id",
            "name",
            "genericName",
            "strength",
            "form",
            "formLabel",
            "category",
            "usage",
            "label",
            "defaultDosage",
        ]
