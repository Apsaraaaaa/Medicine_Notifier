from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db.models import Count

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["id"]
    list_display = [
        "email",
        "name",
        "medicine_count",
        "dose_count",
        "is_staff",
        "is_active",
        "date_joined",
    ]
    list_filter = ["is_staff", "is_superuser", "is_active", "language"]
    search_fields = ["email", "name"]
    date_hierarchy = "date_joined"

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .annotate(n_medicines=Count("medicines", distinct=True))
            .annotate(n_doses=Count("history", distinct=True))
        )

    @admin.display(description="medicines", ordering="n_medicines")
    def medicine_count(self, obj):
        return obj.n_medicines

    @admin.display(description="doses logged", ordering="n_doses")
    def dose_count(self, obj):
        return obj.n_doses
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("name", "language")}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "name", "password1", "password2")}),
    )
