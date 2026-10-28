# Django chatbot integration

This project does not contain the CRM Django source tree. The app in `chatbot/` is a drop-in reference implementation; merge it into the Django project that serves `https://karmaayurvedahospital.co/api/` and adapt its app name/settings as needed. The CRM frontend currently posts public website enquiries to `https://karmaayurvedahospital.co/api/dme/addenquiry` with `name`, `phone_number`, `disease`, `dme_message`, `source`, and `country`.

## What the Django app does

- Creates a database row for each conversation and each user/assistant message.
- Uses OpenAI from the server to reply and extract only details explicitly provided in the conversation.
- Optionally retrieves relevant passages from an approved knowledge base when `OPENAI_VECTOR_STORE_ID` is configured.
- Requests permission before sharing contact details with the CRM team; an affirmative is accepted only after that request has been sent.
- Calls the existing CRM `AddEnquiry` endpoint after the user has provided their name, phone number, condition, and clear permission.
- Keeps the OpenAI key and optional CRM service credential on the server.

## Install and wire into your existing Django project

1. Back up the Django project and use its existing virtual environment. From the directory containing `manage.py`, create the app with `python manage.py startapp chatbot`. Copy the supplied files from this project's `backend/chatbot/` into that new app (merge `models.py`, `views.py`, and `urls.py` if Django generated them). Do not replace your existing `settings.py`, database settings, CRM app, or URL configuration.
2. Install the add-on dependencies from this folder:

   ```powershell
   pip install -r requirements-chatbot.txt
   ```

   Django and Django REST Framework are already part of the CRM environment. If you install into another environment, install those too.

3. Add `"chatbot"` to `INSTALLED_APPS` in the existing Django `settings.py`.
4. Add this URL include to the existing root `urls.py`, keeping all existing patterns. If the project already mounts API apps below `/api/`, attach the chatbot urls under that existing API route instead of adding `/api/` twice:

   ```python
   from django.urls import include, path

   urlpatterns = [
       # keep the existing CRM/API routes
       path("api/chatbot/", include("chatbot.urls")),
   ]
   ```

   With `chatbot.urls` from this project, the endpoint is `POST /api/chatbot/api_end_point` (no trailing slash). If the project already has a parent `path("api/", ...)`, use `path("chatbot/", include("chatbot.urls"))` inside it. Do not configure both a parent `/api/` and a nested `/api/` prefix.
5. Set server environment variables. Never put these in a `NEXT_PUBLIC_*` variable or commit a real secret:

   ```text
   OPENAI_API_KEY=your-server-side-openai-key
   OPENAI_CHAT_MODEL=gpt-4o-mini
   OPENAI_VECTOR_STORE_ID=vs_your_approved_reference_store
   CRM_ADDENQUIRY_URL=https://karmaayurvedahospital.co/api/dme/addenquiry
   CRM_CHATBOT_SOURCE=Karma Ayurveda Website Chatbot
   CRM_CHATBOT_COUNTRY=india
   ```

   `CRM_CHATBOT_AUTHORIZATION` is optional. Only set it if the production AddEnquiry endpoint requires a service credential, in the exact format expected by that API. CRM_Frontend uses an authenticated request interceptor for staff users; its public landing page also calls AddEnquiry without an Authorization header. Confirm which behavior applies in the deployed backend before setting this value.

6. If the website and Django API use different origins, configure `django-cors-headers` in the existing Django settings: add `"corsheaders"` near the top of `INSTALLED_APPS`, add `"corsheaders.middleware.CorsMiddleware"` before `CommonMiddleware`, and allow only the website's real origin, for example:

   ```python
   CORS_ALLOWED_ORIGINS = ["https://your-public-website.example"]
   ```

   Do not use `CORS_ALLOW_ALL_ORIGINS = True` in production. If both are served from the same origin or reverse proxy, CORS is not needed.

7. Create and apply migrations in the CRM backend's active environment/database:

   ```powershell
   python manage.py makemigrations chatbot
   python manage.py migrate
   ```

8. Set `NEXT_PUBLIC_CHATBOT_API_URL=https://karmaayurvedahospital.co/api/chatbot/api_end_point` in the chatbot frontend environment and rebuild/redeploy the frontend. This API is on the same origin as the CRM host, so browser CORS does not apply if the chatbot page is also served from `karmaayurvedahospital.co`. If the website uses another origin, allow only that website origin in Django's CORS settings.
9. Start Django and the frontend, send a message, then check Django's database for `ChatConversation` and `ChatMessage` records. Confirm a lead only appears in CRM after giving consent and supplying all three details. Check Django logs if OpenAI or CRM returns an error.

### Check the endpoint before connecting the website

After Django is running, verify the exact public route (no trailing slash):

```powershell
$body = @{ conversation_id = $null; message = "I have a question about kidney health" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://karmaayurvedahospital.co/api/chatbot/api_end_point" -Method Post -ContentType "application/json" -Body $body
```

The response should include `conversation_id`, `reply`, `lead_status`, and `lead_created`. Then set the frontend's `NEXT_PUBLIC_CHATBOT_API_URL` to that same URL and redeploy the frontend.

## API contract

POST request:

```json
{"conversation_id": null, "message": "I've been having kidney discomfort"}
```

Subsequent messages send the `conversation_id` returned from the first request. Response:

```json
{"conversation_id":"<uuid>","reply":"...","lead_status":"collecting","lead_created":false}
```

`lead_status` is `collecting`, `awaiting_consent`, `created`, or `failed`. The chat stores its transcript in Django; the browser stores only the opaque conversation ID and fetches the transcript on reload using `GET /api/chatbot/api_end_point?conversation_id=<uuid>`. Clear `karma-chat-conversation-id` in the browser to begin a new conversation.

## CRM compatibility details to confirm

- The CRM API accepts public website leads without a staff token (the existing `Landing_pages/Page1.html` does so).
- The disease value extracted in chat must match the disease format expected by the production CRM endpoint. If it requires a configured disease record, add backend validation/mapping before calling `create_crm_enquiry`.
- The CRM API returns HTTP success plus a JSON `success`, `id`, or `data` field when it creates an enquiry. Adjust the response check in `services.py` if the live API returns a different shape.
- `dme_message` includes the transcript. Confirm your privacy/retention rules before enabling this on the live database.

The assistant provides general information only. Keep clinician review, emergency escalation, and privacy disclosures appropriate for the jurisdiction where the website operates.

## Improve the assistant's health knowledge

The current app calls a hosted model; it does **not** train a model from scratch. I added optional retrieval-augmented generation (RAG): if `OPENAI_VECTOR_STORE_ID` is set, Django searches that store for up to four relevant passages and supplies them to the existing model. OpenAI vector stores are searchable knowledge collections; they do not change the model's weights. See the [OpenAI vector store API](https://platform.openai.com/docs/api-reference/vector-stores) and [file search guide](https://platform.openai.com/docs/guides/tools-file-search).

Recommended implementation sequence:

1. **Start with a reviewed knowledge base.** Ask a qualified clinician and your compliance/privacy owner to approve the exact content. Suitable starting material is public, reviewed FAQ and service information, clinic/contact details, and conservative educational material. Avoid patient records, identifiable chat logs, unreviewed treatment claims, and medicine/dosage instructions.
2. **Prepare and version documents.** Use clear, short UTF-8 `.md`, `.txt`, or PDF files. Keep each document focused and include its title, source, owner/reviewer, review date, and expiry/review date. Remove outdated or contradictory copies. Keep the originals in your controlled repository; upload only the approved copies.
3. **Create an OpenAI vector store and upload the approved files.** In the OpenAI API project used by Django, create a vector store, upload the reviewed documents to it, and wait until file processing is complete. The API supports vector store creation, document attachment, and semantic search; consult the linked current guide for the upload flow and supported file types. Copy the resulting `vs_...` ID into the Django server environment as `OPENAI_VECTOR_STORE_ID`, then restart Django. The code in `services.py` now performs the search and adds the retrieved excerpts to the prompt. No patient data is needed for this step.
4. **Evaluate before launch.** Build a held-out set of realistic questions covering common conditions, missing details, ambiguous consent, explicit refusal, emergency warning signs, out-of-scope questions, and attempts to obtain diagnoses or medication instructions. Have clinicians review answers for safety and grounding. Check both response quality and lead creation/consent behavior. Fix the knowledge documents or prompt when an answer fails; don't treat fluent answers as evidence of medical correctness.
5. **Monitor with restricted access.** Review a limited sample under your privacy policy, track retrieval misses and safety errors, and refresh/remove documents when they expire. Set and enforce retention/access controls for the transcript database.

Consider fine-tuning only if you have a stable, repeated behavior problem that prompt instructions and retrieval do not fix, such as a consistent reply format or style. Fine-tuning does not replace a reviewed clinical knowledge base and should not be used to memorize sensitive patient conversations. First confirm that fine-tuning is currently available for the model in your API project and check its current model limits; OpenAI's fine-tuning API expects an uploaded JSONL training file and supported models vary. See the [fine-tuning guide](https://platform.openai.com/docs/guides/fine-tuning) and [fine-tuning API reference](https://platform.openai.com/docs/api-reference/fine-tuning).

For this chatbot, start with RAG plus clinician review and an evaluation set. Fine-tuning is an optional later project; it is not required to turn on this implementation.
