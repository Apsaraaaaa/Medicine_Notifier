from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import HistoryViewSet, ReportView

router = DefaultRouter()
# The app calls this "history": the record of every answered dose.
router.register("history", HistoryViewSet, basename="history")

urlpatterns = [
    path("reports/", ReportView.as_view(), name="report"),
    path("", include(router.urls)),
]
