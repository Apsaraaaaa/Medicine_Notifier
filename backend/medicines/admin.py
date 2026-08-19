from django.contrib import admin
from django.utils.html import format_html

from reminders.models import HistoryEntry

from .models import Medicine


class HistoryEntryInline(admin.TabularInline):
    """The most recent doses for this medicine, read-only for reference."""

    model = HistoryEntry
    extra = 0
    can_delete = False
    fields = ["scheduled_date", "scheduled_time", "status", "note", "taken_at"]
    readonly_fields = fields
    ordering = ["-scheduled_date", "-scheduled_time"]
    verbose_name_plural = "recent dose records"

    def has_add_permission(self, request, obj):
        # Dose records are written by the app when the user answers a reminder.
        return False


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "user",
        "dosage",
        "frequency",
        "reminder_times",
        "swatch",
        "start_date",
        "end_date",
        "is_active",
    ]
    list_filter = ["is_active", "start_date", "frequency"]
    search_fields = ["name", "dosage", "user__email", "user__name"]
    autocomplete_fields = ["user"]
    date_hierarchy = "start_date"
    list_per_page = 25
    readonly_fields = ["created_at", "updated_at"]
    inlines = [HistoryEntryInline]
    fieldsets = (
        (None, {"fields": ("user", "name", "dosage", "frequency", "is_active")}),
        ("Schedule", {"fields": ("times", "start_date", "end_date")}),
        ("Presentation", {"fields": ("color", "instructions")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description="reminders")
    def reminder_times(self, obj):
        return ", ".join(obj.times) if obj.times else "—"

    @admin.display(description="colour")
    def swatch(self, obj):
        if not obj.color:
            return "—"
        return format_html(
            '<span style="display:inline-block;width:14px;height:14px;'
            'border-radius:50%;background:{};vertical-align:middle"></span> {}',
            obj.color,
            obj.color,
        )
