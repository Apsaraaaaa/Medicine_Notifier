"""Auth endpoints: register, login, logout, profile, change password."""

import logging

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
    tokens_for,
)

logger = logging.getLogger(__name__)


class RegisterView(APIView):
    """POST /api/auth/register/  ->  {access, refresh, user}"""

    # Empty authentication_classes, not just AllowAny: DRF authenticates before
    # it checks permissions, so a stale Authorization header left in the app's
    # storage would 401 here and lock the user out of signing up at all.
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {**tokens_for(user), "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """POST /api/auth/login/  ->  {access, refresh, user}"""

    # See RegisterView: a stale token must never block logging back in.
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return Response({**tokens_for(user), "user": UserSerializer(user).data})


class LogoutView(APIView):
    """
    POST /api/auth/logout/  {"refresh": "..."}

    Blacklists the refresh token so it cannot be exchanged again. Returns 205
    either way: logging out should never fail the client's UI.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("refresh")
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                # Already expired or blacklisted — the desired end state anyway.
                logger.debug("Logout received an unusable refresh token.")
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    """GET /api/auth/me/ and PATCH /api/auth/profile/ share this representation."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    """POST /api/auth/change-password/"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password updated."})
