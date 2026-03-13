## JobScope Server API Reference

This document describes the HTTP API exposed by the JobScope server in `src/server.ts` / `src/index.ts`.

- **Base URL (local development)**: `http://localhost:<PORT>` (see `config.PORT`, usually `3000` or `4000`)
- **Content type**: All JSON endpoints expect and return `application/json` unless stated otherwise.
- **Authentication**: Most endpoints require a JWT access token issued by the `/auth` endpoints.

---

## Authentication

All protected routes use the middleware in `src/api/middleware/auth.ts`.

- **Header-based auth**: `Authorization: Bearer <ACCESS_TOKEN>`
- **Alternative (mainly for debugging)**: `GET /protected?token=<ACCESS_TOKEN>`

If the token is missing or invalid, the API responds with:

```json
{ "error": "Missing or invalid authorization" }
```
or
```json
{ "error": "Invalid or expired token" }
```

### POST /auth/register

Create a new user account and receive an access token.

- **URL**: `/auth/register`
- **Method**: `POST`
- **Auth required**: No
- **Request body**:

```json
{
  "email": "user@example.com",
  "password": "strongPassword123"
}
```

Validation (from `registerSchema` in `src/api/auth.ts`):
- **email**: must be a valid email
- **password**: minimum length 8

- **Success response** `201 Created`:

```json
{
  "token": "<JWT_ACCESS_TOKEN>",
  "user": {
    "id": "<user-id>",
    "email": "user@example.com"
  }
}
```

- **Error responses**:
  - `400` with `{ "error": "Validation failed", "issues": { ... } }` if body is invalid
  - `400` with `{ "error": "Email already registered" }` if email is taken

**Example (curl)**:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"strongPassword123"}'
```

### POST /auth/login

Log in an existing user and receive both access and refresh tokens.

- **URL**: `/auth/login`
- **Method**: `POST`
- **Auth required**: No
- **Request body**:

```json
{
  "email": "user@example.com",
  "password": "strongPassword123"
}
```

Validation (from `loginSchema`):
- **email**: valid email
- **password**: non-empty string

- **Success response** `200 OK`:

```json
{
  "token": "<JWT_ACCESS_TOKEN>",
  "refreshToken": "<REFRESH_TOKEN>",
  "user": {
    "id": "<user-id>",
    "email": "user@example.com"
  }
}
```

- **Error responses**:
  - `400` validation error as above
  - `400` with `{ "error": "Invalid email or password" }` on bad credentials

**Example (curl)**:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"strongPassword123"}'
```

### POST /auth/refresh

Exchange a refresh token for a new access token.

- **URL**: `/auth/refresh`
- **Method**: `POST`
- **Auth required**: No
- **Request body**:

```json
{
  "refreshToken": "<REFRESH_TOKEN>"
}
```

- **Success response** `200 OK`:

```json
{
  "token": "<NEW_JWT_ACCESS_TOKEN>"
}
```

- **Error responses**:
  - `400` validation error if `refreshToken` is missing/empty
  - `400` with `{ "error": "Invalid or expired refresh token" }` if token not found in Redis

**Example (curl)**:

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

### POST /auth/logout

Invalidate a refresh token.

- **URL**: `/auth/logout`
- **Method**: `POST`
- **Auth required**: No (token itself is validated in Redis)
- **Request body**:

```json
{
  "refreshToken": "<REFRESH_TOKEN>"
}
```

- **Success response** `200 OK`:

```json
{ "ok": true }
```

- **Error responses**:
  - `400` validation error if `refreshToken` is missing/empty  
  - (Deleting a non-existent key still returns `{ "ok": true }`)

**Example (curl)**:

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

---

## Resume

All resume endpoints are defined in `src/api/resume.ts` and mounted under `/resume`. They require an authenticated user (via `authenticate` middleware).

### POST /resume/upload

Upload a resume file (PDF or DOCX). The file is stored in S3 and a background parse job is queued.

- **URL**: `/resume/upload`
- **Method**: `POST`
- **Auth required**: Yes
- **Content type**: `multipart/form-data`
- **Form fields**:
  - `resume`: file field (required)

Constraints:
- **Max size**: 10 MB
- **Allowed MIME types**:
  - `application/pdf`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

- **Success response** `201 Created`:

```json
{
  "resumeId": "<resume-id>",
  "status": "pending"
}
```

- **Error responses**:
  - `400` with `{ "error": "Missing file field: resume" }` if file is missing
  - `400` with `{ "error": "Invalid file type. Only PDF and DOCX are allowed." }`
  - `401` / `403` / `500` as per global error handler

**Example (curl)**:

```bash
curl -X POST http://localhost:3000/resume/upload \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -F "resume=@/path/to/resume.pdf"
```

### GET /resume/status

Get the latest resume processing status and extracted metadata for the authenticated user.

- **URL**: `/resume/status`
- **Method**: `GET`
- **Auth required**: Yes
- **Query params**: none

- **Success response** `200 OK`:
  - If no resume exists: `null`
  - Otherwise:

```json
{
  "id": "<resume-id>",
  "status": "pending | ready | failed",
  "skills": ["TypeScript", "React"],
  "techStack": ["Node.js", "PostgreSQL"],
  "seniority": "mid",
  "createdAt": "2026-03-13T12:34:56.789Z"
}
```

**Example (curl)**:

```bash
curl -X GET http://localhost:3000/resume/status \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### GET /resume/:id/download

Get a temporary pre-signed URL to download a previously uploaded resume file.

- **URL**: `/resume/:id/download`
- **Method**: `GET`
- **Auth required**: Yes
- **Path params**:
  - `id`: resume ID

Authorization:
- Uses `ownResume` middleware to ensure the requested resume belongs to the current user.

- **Success response** `200 OK`:

```json
{
  "url": "https://s3-bucket/...signed-url..."
}
```

- **Error responses**:
  - `403` if the resume does not belong to the user or `userId` is missing
  - `404` with `{ "error": "Resume not found" }` if ID is invalid

**Example (curl)**:

```bash
curl -X GET http://localhost:3000/resume/<RESUME_ID>/download \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## Sources

Source endpoints are defined in `src/api/sources.ts` and mounted under `/sources`. They are all authenticated.

### POST /sources

Create a new job source (e.g. a job board URL). The platform is auto-detected and a scrape job is queued.

- **URL**: `/sources`
- **Method**: `POST`
- **Auth required**: Yes
- **Request body**:

```json
{
  "url": "https://example.com/jobs/123"
}
```

Validation (from `createSourceSchema`):
- `url`: must be a valid URL string

- **Success response** `201 Created`:

```json
{
  "sourceId": "<source-id>",
  "platform": "greenhouse" // or lever, ashby, etc., depending on detector
}
```

- **Error responses**:
  - `400` validation error if URL is invalid

**Example (curl)**:

```bash
curl -X POST http://localhost:3000/sources \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/jobs/123"}'
```

### GET /sources

List all sources for the current user.

- **URL**: `/sources`
- **Method**: `GET`
- **Auth required**: Yes

- **Success response** `200 OK`:

```json
[
  {
    "id": "<source-id>",
    "url": "https://example.com/jobs/123",
    "platform": "greenhouse",
    "lastScrapedAt": "2026-03-13T12:34:56.789Z"
  }
]
```

**Example (curl)**:

```bash
curl -X GET http://localhost:3000/sources \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## Jobs

Job endpoints are defined in `src/api/jobs.ts` and mounted under `/jobs`. They are authenticated and rely on the latest processed resume for rankings.

### GET /jobs/feed

Get a personalized job feed ranked by similarity to the user’s latest ready resume.

- **URL**: `/jobs/feed`
- **Method**: `GET`
- **Auth required**: Yes
- **Query params**:
  - `page` (optional, default `1`, minimum `1`)
  - `limit` (optional, default `20`, minimum `1`, maximum `100`)

If the user has no ready resume with an embedding, the endpoint returns an empty list.

- **Success response** `200 OK`:

```json
[
  {
    "id": "<job-id>",
    "title": "Senior Software Engineer",
    "company": "Acme Corp",
    "location": "Remote",
    "salary": "$150k - $180k",
    "applyUrl": "https://example.com/jobs/123/apply",
    "skills": ["TypeScript", "React"],
    "seniority": "senior",
    "score": 0.87
  }
]
```

**Example (curl)**:

```bash
curl -X GET "http://localhost:3000/jobs/feed?page=1&limit=20" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### GET /jobs/:id

Fetch the full details of a single job by ID.

- **URL**: `/jobs/:id`
- **Method**: `GET`
- **Auth required**: Yes
- **Path params**:
  - `id`: job ID

- **Success response** `200 OK`:

```json
{
  "id": "<job-id>",
  "title": "Senior Software Engineer",
  "company": "Acme Corp",
  "location": "Remote",
  "salary": "$150k - $180k",
  "description": "Full job description text...",
  "applyUrl": "https://example.com/jobs/123/apply",
  "skills": ["TypeScript", "React"],
  "seniority": "senior",
  "techStack": ["Node.js", "PostgreSQL"],
  "createdAt": "2026-03-13T12:34:56.789Z"
}
```

- **Error responses**:
  - `404` with `{ "error": "Job not found" }` if ID is missing or invalid

**Example (curl)**:

```bash
curl -X GET http://localhost:3000/jobs/<JOB_ID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## Health

Health endpoints are in `src/api/health.ts` and mounted under `/health`.

### GET /health

Check basic health of the API, database, and Redis.

- **URL**: `/health`
- **Method**: `GET`
- **Auth required**: No

- **Success response** `200 OK`:

```json
{
  "status": "ok",
  "ts": "2026-03-13T12:34:56.789Z"
}
```

- **Degraded response** `503 Service Unavailable`:

```json
{
  "status": "unhealthy",
  "ts": "2026-03-13T12:34:56.789Z",
  "db": "ok | down",
  "redis": "ok | down"
}
```

**Example (curl)**:

```bash
curl -X GET http://localhost:3000/health
```

---

## Error Handling Overview

Global error handling is implemented in `src/lib/errors.ts` and applied as the last middleware in `src/server.ts`.

- **Validation errors** (`ZodError`):

```json
{
  "error": "Validation failed",
  "issues": {
    "fieldName": ["Error message"]
  }
}
```

- **Application errors** (`AppError` and subclasses):

```json
{ "error": "Human-readable message" }
```

with appropriate HTTP status codes (`400`, `401`, `403`, `404`, etc.).

- **Unhandled errors**:

```json
{ "error": "Internal server error" }
```

Check server logs for details when debugging unhandled errors.

