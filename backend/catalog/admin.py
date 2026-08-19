from django.contrib import admin

from .models import CatalogMedicine


@admin.register(CatalogMedicine)
class CatalogMedicineAdmin(admin.ModelAdmin):
    list_display = ["name", "strength", "form", "generic_name", "category", "is_active"]
    list_filter = ["form", "category", "is_active"]
    search_fields = ["name", "generic_name", "category", "usage"]
    list_editable = ["is_active"]
    list_per_page = 50
    fieldsets = (
        (None, {"fields": ("name", "generic_name", "strength", "form")}),
        ("Description", {"fields": ("category", "usage", "is_active")}),
    )
