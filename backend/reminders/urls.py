from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import HistoryViewSet

router = DefaultRouter()
# The app calls this "history": the record of every answered dose.
router.register("history", HistoryViewSet, basename="history")

urlpatterns = [path("", include(router.urls))]
