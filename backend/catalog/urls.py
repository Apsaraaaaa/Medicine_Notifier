from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CatalogViewSet, ScanView

router = DefaultRouter()
router.register("catalog", CatalogViewSet, basename="catalog")

urlpatterns = [
    # Before the router, so "scan" is never read as a catalog entry id.
    path("catalog/scan/", ScanView.as_view(), name="catalog-scan"),
    path("", include(router.urls)),
]
