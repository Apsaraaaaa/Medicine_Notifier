"""Caregiver routes, mounted under /api/ by config/urls.py."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AcceptInviteView,
    AlertViewSet,
    CaregiverLinkViewSet,
    PatientListView,
    PatientReportView,
)

router = DefaultRouter()
# Alerts are registered first on purpose: the router matches in registration
# order, and `caregivers/<pk>/` would otherwise swallow `caregivers/alerts/`
# and look for a link whose id is the word "alerts".
router.register("caregivers/alerts", AlertViewSet, basename="caregiver-alert")
router.register("caregivers", CaregiverLinkViewSet, basename="caregiver")

urlpatterns = [
    # Declared before the router so "patients" is never read as a link id.
    path("caregivers/accept/", AcceptInviteView.as_view(), name="caregiver-accept"),
    path("caregivers/patients/", PatientListView.as_view(), name="caregiver-patients"),
    path(
        "caregivers/patients/<int:pk>/",
        PatientReportView.as_view(),
        name="caregiver-patient-report",
    ),
    path("", include(router.urls)),
]
