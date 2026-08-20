from django.contrib import admin

from .models import CaregiverAlert, CaregiverLink


class CaregiverAlertInline(admin.TabularInline):
    """What this link has raised, read-only — alerts are generated, not typed."""

    model = CaregiverAlert
    extra = 0
    can_delete = False
    fields = ["scheduled_date", "scheduled_time", "medicine_name", "kind", "read_at"]
    readonly_fields = fields
    ordering = ["-scheduled_date", "-scheduled_time"]

    def has_add_permission(self, request, obj):
        return False


@admin.register(CaregiverLink)
class CaregiverLinkAdmin(admin.ModelAdmin):
    list_display = [
        "patient",
        "caregiver_email",
        "caregiver_name",
        "relationship",
        "status",
        "alert_on_missed",
        "created_at",
    ]
    list_filter = ["status", "alert_on_missed"]
    search_fields = ["caregiver_email", "caregiver_name", "patient__email", "patient__name"]
    autocomplete_fields = ["patient", "caregiver"]
    readonly_fields = ["invite_code", "created_at", "accepted_at"]
    inlines = [CaregiverAlertInline]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("patient", "caregiver")


@admin.register(CaregiverAlert)
class CaregiverAlertAdmin(admin.ModelAdmin):
    list_display = ["medicine_name", "link", "scheduled_date", "scheduled_time", "kind", "read_at"]
    list_filter = ["kind", "scheduled_date"]
    search_fields = ["medicine_name", "link__caregiver_email", "link__patient__email"]
    date_hierarchy = "scheduled_date"
    readonly_fields = ["created_at"]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("link", "link__patient")
