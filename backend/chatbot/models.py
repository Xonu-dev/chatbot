import uuid

from django.db import models


class ChatConversation(models.Model):
    class LeadStatus(models.TextChoices):
        COLLECTING = "collecting", "Collecting details"
        AWAITING_CONSENT = "awaiting_consent", "Awaiting consent"
        CREATED = "created", "Enquiry created"
        FAILED = "failed", "Enquiry creation failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    country_code = models.CharField(max_length=8, default="+91")
    disease = models.CharField(max_length=200, blank=True)
    consent_requested = models.BooleanField(default=False)
    lead_consent = models.BooleanField(null=True, blank=True)
    lead_status = models.CharField(
        max_length=24, choices=LeadStatus.choices, default=LeadStatus.COLLECTING
    )
    crm_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)


class ChatMessage(models.Model):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"

    conversation = models.ForeignKey(
        ChatConversation, related_name="messages", on_delete=models.CASCADE
    )
    role = models.CharField(max_length=12, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")
