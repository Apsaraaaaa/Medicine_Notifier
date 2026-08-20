"""
Catalog search — the source of the app's autocomplete suggestions.

Ranking matters more than filtering here: typing "para" should put
"Paracetamol" above "Paracetamol + Caffeine" and well above a medicine that
merely mentions paracetamol in its generic name. So results are scored by where
the match lands rather than left in alphabetical order.
"""

from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework import mixins, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CatalogMedicine
from .scan import extract, ocr_available, run_ocr
from .serializers import CatalogMedicineSerializer

MAX_RESULTS = 50
DEFAULT_RESULTS = 12
MIN_QUERY = 2


class CatalogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    GET /api/catalog/?q=para&limit=12   search suggestions
    GET /api/catalog/<id>/              one catalog entry

    Read-only: the catalog is shared reference data, maintained in the admin,
    never written by the app.
    """

    serializer_class = CatalogMedicineSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = CatalogMedicine.objects.filter(is_active=True)

        query = (self.request.query_params.get("q") or "").strip()
        form = (self.request.query_params.get("form") or "").strip()
        if form:
            qs = qs.filter(form=form)

        if len(query) < MIN_QUERY:
            # Too short to be meaningful: return a small alphabetical sample so
            # the field can show something useful before the user commits.
            return qs.order_by("name", "strength")[:DEFAULT_RESULTS]

        qs = qs.filter(
            Q(name__istartswith=query)
            | Q(generic_name__istartswith=query)
            | Q(name__icontains=query)
            | Q(generic_name__icontains=query)
            | Q(category__icontains=query)
        ).annotate(
            rank=Case(
                When(name__iexact=query, then=Value(0)),
                When(name__istartswith=query, then=Value(1)),
                When(generic_name__istartswith=query, then=Value(2)),
                When(name__icontains=query, then=Value(3)),
                When(generic_name__icontains=query, then=Value(4)),
                default=Value(5),
                output_field=IntegerField(),
            )
        )

        try:
            limit = int(self.request.query_params.get("limit", DEFAULT_RESULTS))
        except ValueError:
            limit = DEFAULT_RESULTS
        limit = max(1, min(limit, MAX_RESULTS))

        return qs.order_by("rank", "name", "strength")[:limit]


# A phone camera photo, at the quality OCR needs. Bigger than this is a file
# picked by mistake, and reading it would tie up a worker for no benefit.
MAX_IMAGE_BYTES = 12 * 1024 * 1024


class ScanView(APIView):
    """
    POST /api/catalog/scan/

    Reads a medicine box or a prescription and returns the fields to prefill
    the Add Medicine form with. Two ways in, both landing in the same parser:

        multipart  image=<file>   photograph of the box or slip
        json       {"text": "..."}  the label typed out, or text from any
                                    other recogniser

    Nothing is saved. The response is a *suggestion* — the app shows it in the
    normal form and the user edits and confirms it before anything is created.

    GET reports whether image recognition is available on this server, so the
    app can offer the camera or ask for typing without having to guess.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        return Response({"imageSupported": ocr_available()})

    def post(self, request):
        text = (request.data.get("text") or "").strip()

        if not text:
            image = request.FILES.get("image") or request.FILES.get("file")
            if image is None:
                return Response(
                    {"detail": "Send an image file or the label text."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if image.size > MAX_IMAGE_BYTES:
                return Response(
                    {"detail": "That image is too large. Take the photo again at a lower size."},
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )
            try:
                text = run_ocr(image.read())
            except RuntimeError as exc:
                # No engine on this machine. 503, not 500: the request was fine,
                # the capability is missing — and the app offers typing instead.
                return Response(
                    {"detail": str(exc), "imageSupported": False},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            except Exception:
                return Response(
                    {"detail": "That image could not be read. Try a sharper, straighter photo."},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

        result = extract(text)
        return Response({**result, "imageSupported": ocr_available()})
