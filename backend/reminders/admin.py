from django.contrib import admin

from .models import HistoryEntry


@admin.register(HistoryEntry)
class HistoryEntryAdmin(admin.ModelAdmin):
    list_display = [
        "medicine_name",
        "user",
        "scheduled_date",
        "scheduled_time",
        "status",
        "dosage",
        "taken_at",
    ]
    list_filter = ["status", "scheduled_date"]
    search_fields = ["medicine_name", "dosage", "note", "user__email", "user__name"]
    autocomplete_fields = ["user", "medicine"]
    date_hierarchy = "scheduled_date"
    list_per_page = 50
    readonly_fields = ["created_at", "updated_at"]
    fieldsets = (
        (None, {"fields": ("user", "medicine", "medicine_name", "dosage")}),
        ("The dose", {"fields": ("scheduled_date", "scheduled_time", "status", "taken_at", "note")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    def get_queryset(self, request):
        # Every row renders its user and medicine, so fetch them in one query.
        return super().get_queryset(request).select_related("user", "medicine")
