"""
Shared viewset behaviour.

Ownership rule for every resource: `get_queryset` filters on request.user and
`perform_create` stamps request.user, so one user can never read or write
another user's rows — a mismatched id returns 404, not 403, so the API doesn't
leak which ids exist.
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated


class OwnedModelViewSet(viewsets.ModelViewSet):
    """Restricts every action to rows owned by the authenticated user."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.model.objects.filter(user=self.request.user)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
