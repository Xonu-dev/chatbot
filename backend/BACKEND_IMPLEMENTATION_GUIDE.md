# Django Chatbot Backend: Copilot Implementation Guide

Use this guide with the repository open in Copilot Chat. The repository is named
`chatbot`; the Django project configuration package will be named `config`, and
the existing Django application is named `chatbot`. Keeping those names
separate avoids a Python package-name collision.

## Goal

Complete a standalone Django backend in `backend/` for the existing Next.js chat
widget. Preserve the existing chatbot app implementation in `backend/chatbot/`.
Create the missing Django project files, connect the app, apply migrations, and
verify the API contract below. Do not replace or remove existing CRM routes or
settings if this app is instead being integrated into an existing Django
project.

## 1. Inspect the existing app before making changes

The chatbot app source already exists:

- `backend/chatbot/models.py` defines `ChatConversation` and `ChatMessage`.
- `backend/chatbot/views.py` defines `ChatAPIView`, including conversation
  history (`GET`) and message handling (`POST`).
- `backend/chatbot/services.py` generates assistant replies, extracts stated
  lead details, checks explicit consent, optionally searches approved
  knowledge, and submits consented enquiries to the CRM.
- `backend/chatbot/urls.py` maps the app endpoint.
- `backend/chatbot/requirements-chatbot.txt` lists the Python dependencies.

Read these files first. Reuse them as the source of truth; do not replace their
behavior with placeholder views or a second implementation. If code changes are
needed to make the standalone project run, keep them small and compatible with
the API contract below.

## 2. Create the Django project scaffold

From the repository root, the Django project files belong in `backend/`.
Create a virtual environment, install the existing requirements, and create the
project configuration package only if it does not already exist:

```powershell
Set-Location .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\chatbot\requirements-chatbot.txt
django-admin startproject config .
```

The resulting layout should include:

```text
backend/
  manage.py
  config/
    __init__.py
    asgi.py
    settings.py
    urls.py
    wsgi.py
  chatbot/
    __init__.py
    models.py
    services.py
    urls.py
    views.py
    requirements-chatbot.txt
```

Do not run `startapp chatbot`: that application already exists. Add an
`apps.py` with a `ChatbotConfig` only if the project needs an explicit app
configuration.

## 3. Configure Django settings

In `backend/config/settings.py`:

1. Keep Django's generated core apps and middleware.
2. Add `"rest_framework"` and `"chatbot"` to `INSTALLED_APPS`.
3. Keep the generated SQLite database for local development unless the project
   already has a database configuration. Use a persistent, appropriately
   protected database in production.
4. Configure `ALLOWED_HOSTS` for the actual development and production hosts;
   do not use `"*"` in production.
5. Read `SECRET_KEY`, `DEBUG`, and other deployment-specific settings from
   environment variables. Never commit real secrets.
6. CORS is not needed when the frontend and API share an origin. If they do not,
   add `corsheaders` and `CorsMiddleware` using the installed
   `django-cors-headers` package, then allow only the actual frontend origin.
   Do not enable all origins in production.

The OpenAI and CRM values used by the existing service code must be supplied
to the Django process through its server-side environment:

```text
OPENAI_API_KEY=<server-side OpenAI key>
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_VECTOR_STORE_ID=<optional approved vector store id>
CRM_ADDENQUIRY_URL=https://karmaayurvedahospital.co/api/dme/addenquiry
CRM_CHATBOT_SOURCE=Karma Ayurveda Website Chatbot
CRM_CHATBOT_COUNTRY=india
CRM_CHATBOT_AUTHORIZATION=<optional; only if required by the deployed CRM>
```

Do not put any of these credentials in a `NEXT_PUBLIC_*` variable or commit
their values. `OPENAI_VECTOR_STORE_ID` and
`CRM_CHATBOT_AUTHORIZATION` are optional. Confirm the live CRM's expected
authorization and response format before enabling the optional token.

## 4. Wire the project and app URLs

In `backend/config/urls.py`, keep Django's admin route and include the chatbot
app under the exact prefix expected by the frontend:

```python
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/chatbot/", include("chatbot.urls")),
]
```

In `backend/chatbot/urls.py`, use the app route without a trailing slash:

```python
from django.urls import path

from .views import ChatAPIView

urlpatterns = [
    path("api_end_point", ChatAPIView.as_view(), name="chatbot-api-end-point"),
]
```

The resulting public routes are:

| Method | URL | Purpose |
| --- | --- | --- |
| `POST` | `/api/chatbot/api_end_point` | Start a conversation or send a message |
| `GET` | `/api/chatbot/api_end_point?conversation_id=<uuid>` | Load saved conversation history |

The route intentionally has no trailing slash. Do not add another `api/`
prefix in a parent URL include.

## 5. Preserve the models and backend behavior

Use the existing `backend/chatbot/models.py` as the schema. It stores:

- Conversation UUID, lead details, consent state, lead status, CRM response,
  and timestamps.
- Ordered user and assistant messages related to each conversation.

Use the existing `backend/chatbot/views.py` as the endpoint implementation.
It validates messages (1–4000 characters), creates and retrieves conversations,
persists the transcript, and returns JSON responses. It requires explicit
affirmative consent after the assistant has asked permission before sharing
lead details with the CRM.

Use `backend/chatbot/services.py` for server-side model calls and CRM
integration. Keep OpenAI and CRM credentials exclusively on the server. Keep
the health-safety behavior: the assistant provides general information, does
not diagnose or prescribe, and directs emergencies to local emergency care.
Do not create a CRM enquiry unless the name, phone number, condition, and
explicit consent are all present.

## 6. Match the frontend API contract

The widget sends this JSON body to `POST`:

```json
{
  "conversation_id": null,
  "message": "I have a question about kidney health"
}
```

For later messages, send the `conversation_id` returned by the previous
response. A successful response must include:

```json
{
  "conversation_id": "<uuid>",
  "reply": "Assistant response",
  "lead_status": "collecting",
  "lead_created": false
}
```

`lead_status` must be one of `collecting`, `awaiting_consent`, `created`, or
`failed`. Invalid messages return HTTP 400; an unavailable assistant returns
HTTP 503. A missing or invalid conversation ID on `GET` returns HTTP 404.

The `GET` response must have this shape so the widget can restore its transcript:

```json
{
  "conversation_id": "<uuid>",
  "messages": [
    { "id": "<id>", "role": "user", "text": "..." },
    { "id": "<id>", "role": "assistant", "text": "..." }
  ]
}
```

## 7. Create the database schema

From `backend/`, run:

```powershell
python manage.py makemigrations chatbot
python manage.py migrate
```

Confirm the migration creates both chatbot tables. Do not run migrations
against a production database until its backup and deployment process are
confirmed.

## 8. Connect the frontend

The frontend already uses
`NEXT_PUBLIC_CHATBOT_API_URL`. Set it in the frontend environment to the full
endpoint URL:

```text
NEXT_PUBLIC_CHATBOT_API_URL=https://karmaayurvedahospital.co/api/chatbot/api_end_point
```

For local development, set it to the reachable local Django URL, for example
`http://127.0.0.1:8000/api/chatbot/api_end_point`. Use `.env.local` for this
frontend URL; never put OpenAI or CRM credentials there.

The frontend stores only the conversation UUID in browser storage and retrieves
the saved messages from the `GET` endpoint after reload. Preserve the JSON
field names and the exact route when changing either side.

## 9. Run and verify locally

Start Django from `backend/`:

```powershell
python manage.py runserver
```

In another PowerShell window, send a message:

```powershell
$body = @{
  conversation_id = $null
  message = "I have a question about kidney health"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/chatbot/api_end_point" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body

$response
```

Use the returned UUID to verify history:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/chatbot/api_end_point?conversation_id=$($response.conversation_id)" `
  -Method Get
```

Before calling OpenAI or the production CRM, verify Django configuration and
database migrations. Then test the full conversation flow, including invalid
input, history retrieval, gathering all required lead fields, declining
consent, and giving consent only after the assistant asks. Verify that the CRM
is called only in the last case. Do not send test enquiries to the production
CRM without authorization.

## Completion checklist for Copilot

- [ ] The Django scaffold is in `backend/` and starts with `manage.py`.
- [ ] Existing chatbot app files are preserved and registered in settings.
- [ ] `GET` and `POST` both work at `/api/chatbot/api_end_point` with no
  trailing slash.
- [ ] Database migrations apply and both models persist.
- [ ] Responses match the JSON shapes and status values in this guide.
- [ ] OpenAI and CRM secrets are server-side environment variables only.
- [ ] CRM submission requires complete lead details and explicit consent.
- [ ] Same-origin deployment needs no permissive CORS configuration.
- [ ] The frontend URL points to the exact endpoint above.
