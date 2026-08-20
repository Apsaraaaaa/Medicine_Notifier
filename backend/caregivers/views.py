"""
Caregiver endpoints.

Two sides of the same rows, and they never share a queryset:

    /api/caregivers/            the patient's side — who may watch me
    /api/caregivers/patients/   the caregiver's side — who I watch

Every read on the caregiver's side re-runs the alert check first (see
services.refresh_alerts), so opening the app is what makes an alert appear.
Access to a patient's data is granted by exactly one thing — an ACTIVE link —
and an id that doesn't resolve to one returns 404 rather than 403, matching the
rest of the API so nothing leaks which accounts exist.
"""

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from reminders.reports import build_report

from .models import CaregiverAlert, CaregiverLink
from .serializers import (
    AcceptInviteSerializer,
    CaregiverAlertSerializer,
    CaregiverLinkSerializer,
    PatientLinkSerializer,
)
from .services import refresh_alerts, refresh_for_caregiver


class CaregiverLinkViewSet(viewsets.ModelViewSet):
    """
    GET/POST              /api/caregivers/
    GET/PATCH/DELETE      /api/caregivers/<id>/

    The people this user has given access to. Deleting a link revokes access.
    """

    serializer_class = CaregiverLinkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        links = CaregiverLink.objects.filter(patient=self.request.user).select_related(
            "caregiver"
        )
        # An invitation sent before the caregiver had an account goes live by
        # itself the first time the patient looks at the list after they join.
        for link in links:
            link.attach_existing_user()
        return links

    def list(self, request, *args, **kwargs):
        refresh_alerts(request.user)
        return super().list(request, *args, **kwargs)

    def perform_destroy(self, instance):
        # Kept as a revoked row rather than deleted: the patient should be able
        # to see that they once shared, and re-inviting reuses the same link.
        instance.status = CaregiverLink.Status.REVOKED
        instance.caregiver = None
        instance.save(update_fields=["status", "caregiver"])


class PatientListView(APIView):
    """GET /api/caregivers/patients/ — everyone this user watches over."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        refresh_for_caregiver(request.user)
        links = (
            CaregiverLink.objects.filter(
                caregiver=request.user, status=CaregiverLink.Status.ACTIVE
            )
            .select_related("patient")
            .prefetch_related("alerts")
        )
        return Response(PatientLinkSerializer(links, many=True).data)


class PatientReportView(APIView):
    """
    GET /api/caregivers/patients/<id>/?range=week|month|all

    The patient's schedule, dose records and adherence — the same report the
    patient sees of themselves, which is the point: one set of numbers.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        link = (
            CaregiverLink.objects.filter(
                pk=pk, caregiver=request.user, status=CaregiverLink.Status.ACTIVE
            )
            .select_related("patient")
            .first()
        )
        if link is None:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        refresh_alerts(link.patient)
        report = build_report(link.patient, request.query_params.get("range", "week"))
        alerts = link.alerts.all()[:50]
        return Response(
            {
                **report,
                "patient": {
                    "id": str(link.patient.id),
                    "name": link.patient.get_full_name(),
                    "email": link.patient.email,
                },
                "link": PatientLinkSerializer(link).data,
                "alerts": CaregiverAlertSerializer(alerts, many=True).data,
            }
        )


class AlertViewSet(viewsets.GenericViewSet):
    """
    GET  /api/caregivers/alerts/            alerts raised for this caregiver
    POST /api/caregivers/alerts/<id>/read/  mark one as seen
    POST /api/caregivers/alerts/read-all/   mark every alert as seen
    """

    serializer_class = CaregiverAlertSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CaregiverAlert.objects.filter(
            link__caregiver=self.request.user, link__status=CaregiverLink.Status.ACTIVE
        ).select_related("link", "link__patient")

    def list(self, request):
        refresh_for_caregiver(request.user)
        unread_only = request.query_params.get("unread") in {"1", "true", "yes"}
        alerts = self.get_queryset()
        if unread_only:
            alerts = alerts.filter(read_at__isnull=True)
        return Response(self.get_serializer(alerts[:100], many=True).data)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        alert = self.get_queryset().filter(pk=pk).first()
        if alert is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if alert.read_at is None:
            alert.read_at = timezone.now()
            alert.save(update_fields=["read_at"])
        return Response(self.get_serializer(alert).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = self.get_queryset().filter(read_at__isnull=True).update(
            read_at=timezone.now()
        )
        return Response({"updated": updated})


class AcceptInviteView(APIView):
    """
    POST /api/caregivers/accept/  {"code": "K7M2QX4T"}

    For the caregiver who was invited before they had an account: redeeming the
    code is what attaches them to the link the patient already created.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AcceptInviteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        link = serializer.link
        link.caregiver = request.user
        link.status = CaregiverLink.Status.ACTIVE
        link.accepted_at = timezone.now()
        link.save(update_fields=["caregiver", "status", "accepted_at"])
        refresh_alerts(link.patient)
        return Response(PatientLinkSerializer(link).data, status=status.HTTP_201_CREATED)
