"""
Root URL configuration.

Everything the mobile app calls lives under /api/, matching EXPO_PUBLIC_API_URL
(http://<host>:8000/api), so a route written as /auth/login/ is served at
/api/auth/login/.
"""

from django.contrib import admin
from django.urls import include, path

from .views import ContactView, ServiceIndexView

# The admin is the project's control panel — the only human-facing UI on the
# server — so it is branded rather than left as "Django administration".
admin.site.site_header = "Medicine Notifier"
admin.site.site_title = "Medicine Notifier admin"
admin.site.index_title = "Accounts, medicines and dose records"

urlpatterns = [
    # A health/index page, so opening the server in a browser is informative
    # rather than a bare 404.
    path("", ServiceIndexView.as_view(), name="service-index"),
    path("admin/", admin.site.urls),
    # Used by the marketing site's contact form, not by the mobile app.
    path("api/contact/", ContactView.as_view(), name="contact"),
    path("api/", include("accounts.urls")),
    path("api/", include("catalog.urls")),
    path("api/", include("medicines.urls")),
    path("api/", include("reminders.urls")),
    path("api/", include("caregivers.urls")),
]
