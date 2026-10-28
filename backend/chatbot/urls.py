from django.urls import path

from .views import ChatAPIView

urlpatterns = [path("api_end_point", ChatAPIView.as_view(), name="chatbot-api-end-point")]
