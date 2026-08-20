"""
The account a phone signs in to.

Email is the login field — the mobile app collects a single free-text `name`
plus an email and password, and nothing in the product needs a username.
"""

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Email is the login field, so username is not part of the signature."""

    use_in_migrations = True

    def create_user(self, email, password=None, name="", **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, name=name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, name="", **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, name, **extra_fields)


class Language(models.TextChoices):
    """
    The language the account reads in.

    The app keeps its own copy on the phone so the UI can switch offline; this
    is the server's copy, used for anything the server writes *for* the user —
    a caregiver alert, for instance, which is composed here and read there.
    """

    ENGLISH = "en", "English"
    NEPALI = "ne", "Nepali"


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150, blank=True)
    language = models.CharField(
        max_length=5, choices=Language.choices, default=Language.ENGLISH
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.email

    def get_full_name(self):
        return self.name or self.email

    def get_short_name(self):
        return self.name.split(" ")[0] if self.name else self.email
