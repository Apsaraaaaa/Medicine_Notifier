from config.viewsets import OwnedModelViewSet

from .models import HistoryEntry
from .serializers import HistoryEntrySerializer


class HistoryViewSet(OwnedModelViewSet):
    """
    GET/POST              /api/history/
    GET/PUT/PATCH/DELETE  /api/history/<id>/

    Filters: ?medicineId= &status= &from=YYYY-MM-DD &to=YYYY-MM-DD
    """

    queryset = HistoryEntry.objects.all()
    serializer_class = HistoryEntrySerializer

    def get_queryset(self):
        qs = super().get_queryset().select_related("medicine")
        params = self.request.query_params
        if (medicine_id := params.get("medicineId")) is not None:
            qs = qs.filter(medicine_id=medicine_id)
        if (entry_status := params.get("status")) is not None:
            qs = qs.filter(status=entry_status)
        if (date_from := params.get("from")) is not None:
            qs = qs.filter(scheduled_date__gte=date_from)
        if (date_to := params.get("to")) is not None:
            qs = qs.filter(scheduled_date__lte=date_to)
        return qs
