import logging
import uuid

from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatConversation, ChatMessage
from .services import create_crm_enquiry, explicit_consent_from_message, get_assistant_turn

logger = logging.getLogger(__name__)


class ChatAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        supplied_id = request.query_params.get("conversation_id")
        try:
            conversation = ChatConversation.objects.get(pk=uuid.UUID(str(supplied_id)))
        except (ValueError, TypeError, ChatConversation.DoesNotExist):
            return Response({"error": "Conversation not found"}, status=404)
        messages = list(conversation.messages.values("id", "role", "content"))
        return Response({
            "conversation_id": str(conversation.pk),
            "messages": [
                {"id": str(row["id"]), "role": row["role"], "text": row["content"]}
                for row in messages
            ],
        })

    def post(self, request):
        message = request.data.get("message", "")
        if not isinstance(message, str) or not message.strip() or len(message) > 4000:
            return Response({"error": "message must contain 1 to 4000 characters"}, status=400)

        supplied_id = request.data.get("conversation_id")
        try:
            with transaction.atomic():
                if supplied_id:
                    conversation = ChatConversation.objects.select_for_update().get(pk=uuid.UUID(str(supplied_id)))
                else:
                    conversation = ChatConversation.objects.create()
                ChatMessage.objects.create(
                    conversation=conversation,
                    role=ChatMessage.Role.USER,
                    content=message.strip(),
                )
        except (ValueError, TypeError, ChatConversation.DoesNotExist):
            return Response({"error": "Invalid conversation_id"}, status=400)

        consent_was_requested = conversation.consent_requested
        try:
            turn = get_assistant_turn(conversation)
        except Exception:
            logger.exception("Chat assistant generation failed for conversation %s", conversation.pk)
            return Response({"error": "The assistant is temporarily unavailable. Please try again."}, status=503)

        # Lead sharing is gated by an explicit request in a previous assistant turn and
        # a clear affirmative in this turn, never by AI inference.
        turn["consent"] = explicit_consent_from_message(message) if consent_was_requested else None

        for field in ("name", "phone_number", "country_code", "disease"):
            if turn[field]:
                setattr(conversation, field, turn[field])
        if turn["consent"] is not None:
            conversation.lead_consent = turn["consent"]

        complete = bool(conversation.name and conversation.phone_number and conversation.disease)
        if not complete:
            conversation.lead_status = ChatConversation.LeadStatus.COLLECTING
        elif not consent_was_requested:
            conversation.consent_requested = True
            conversation.lead_status = ChatConversation.LeadStatus.AWAITING_CONSENT
            turn["reply"] += " May we share your name, phone number, and health concern with Karma Ayurveda so our team can contact you about this enquiry? Please reply yes or no."
        elif conversation.lead_consent is not True:
            conversation.lead_status = ChatConversation.LeadStatus.AWAITING_CONSENT
            if turn["consent"] is False:
                turn["reply"] += " No problem. We won't share these details with our team."
            elif turn["consent"] is None:
                turn["reply"] += " Please reply yes or no to confirm whether we may share these details with our team."
        elif conversation.lead_status != ChatConversation.LeadStatus.CREATED:
            try:
                conversation.crm_response = create_crm_enquiry(conversation)
                conversation.lead_status = ChatConversation.LeadStatus.CREATED
                turn["reply"] += " Your enquiry has been shared with our team, who can contact you."
            except Exception:
                logger.exception("CRM AddEnquiry failed for conversation %s", conversation.pk)
                conversation.lead_status = ChatConversation.LeadStatus.FAILED
                turn["reply"] += " I couldn't register the enquiry just now. Please try again later or contact our team directly."

        with transaction.atomic():
            conversation.save()
            ChatMessage.objects.create(
                conversation=conversation,
                role=ChatMessage.Role.ASSISTANT,
                content=turn["reply"],
            )

        return Response({
            "conversation_id": str(conversation.pk),
            "reply": turn["reply"],
            "lead_status": conversation.lead_status,
            "lead_created": conversation.lead_status == ChatConversation.LeadStatus.CREATED,
        }, status=status.HTTP_200_OK)
