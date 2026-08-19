"""
Catalog search — the source of the app's autocomplete suggestions.

Ranking matters more than filtering here: typing "para" should put
"Paracetamol" above "Paracetamol + Caffeine" and well above a medicine that
merely mentions paracetamol in its generic name. So results are scored by where
the match lands rather than left in alphabetical order.
"""

from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from .models import CatalogMedicine
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
