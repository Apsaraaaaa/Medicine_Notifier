from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.viewsets import OwnedModelViewSet

from .models import HistoryEntry
from .reports import build_report
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


class ReportView(APIView):
    """
    GET /api/reports/?range=week|month|all

    The medicine report: taken, missed, late and skipped doses, the adherence
    percentage, weekly and monthly trends, and a per-medicine breakdown. The
    app renders it and exports it as PDF or CSV; nothing here is stored, so a
    report always reflects the history as it stands right now.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        report = build_report(request.user, request.query_params.get("range", "week"))
        return Response({**report, "patient": {
            "id": str(request.user.id),
            "name": request.user.get_full_name(),
            "email": request.user.email,
        }})
