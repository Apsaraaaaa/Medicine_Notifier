"""
Service index at `/`.

The mobile app never calls this — it exists so that opening the server in a
browser answers the two questions you actually have: is the API up, and is the
database reachable. Without it Django returns a bare 404 at the root, which
looks like a misconfiguration even when everything is fine.
"""

import logging

from django.db import connection
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class ServiceIndexView(APIView):
    # No authentication at all: a stale token must not hide the health check.
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            connection.ensure_connection()
            database = "connected"
        except Exception as exc:  # pragma: no cover - depends on the environment
            database = f"unavailable: {exc.__class__.__name__}"

        return Response(
            {
                "service": "Medicine Notifier API",
                "status": "ok",
                "database": database,
                "engine": connection.vendor,
                "admin": request.build_absolute_uri("/admin/"),
                "endpoints": {
                    "register": "/api/auth/register/",
                    "login": "/api/auth/login/",
                    "logout": "/api/auth/logout/",
                    "me": "/api/auth/me/",
                    "profile": "/api/auth/profile/",
                    "change_password": "/api/auth/change-password/",
                    "refresh": "/api/auth/refresh/",
                    "medicines": "/api/medicines/",
                    "history": "/api/history/",
                },
                "note": (
                    "Endpoints other than register, login and refresh require "
                    "Authorization: Bearer <access token>."
                ),
            }
        )


class ContactSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    message = serializers.CharField(max_length=5000)


class ContactView(APIView):
    """
    POST /api/contact/ — the contact form on the marketing site (web/).

    Public, and deliberately not tied to an account: someone asking a question
    hasn't signed up yet.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Logged for now; swap for send_mail or a Message model once a mail
        # backend is configured.
        logger.info(
            "Contact message from %s <%s>: %s", data["name"], data["email"], data["message"]
        )
        return Response(
            {"detail": "Thanks for getting in touch. We'll reply by email soon."},
            status=status.HTTP_201_CREATED,
        )
