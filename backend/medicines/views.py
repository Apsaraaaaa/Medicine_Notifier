from config.viewsets import OwnedModelViewSet

from .models import Medicine
from .serializers import MedicineSerializer


class MedicineViewSet(OwnedModelViewSet):
    """
    GET/POST              /api/medicines/
    GET/PUT/PATCH/DELETE  /api/medicines/<id>/

    `?active=true|false` narrows the list to a running or finished course.
    """

    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        active = self.request.query_params.get("active")
        if active is not None:
            qs = qs.filter(is_active=active.lower() in {"1", "true", "yes"})
        return qs
