# Cloud Run hosting contract

## Decision

The Output application will run as a Next.js server on Google Cloud Run and
will be protected by Cloud Run's direct Identity-Aware Proxy integration.
The MVP protects the whole application, including the health endpoint. The
initial allowed user is the owner's Google account only.

The Cloud Run service will use no custom domain. Its minimum instance count is
zero and its maximum instance count is one. A monthly JPY 1,000 budget alert is
planned. A budget alert is a notification and is not a hard spending limit or
an automatic service shutdown.

These Cloud resources are not created or configured by this change.

## Runtime boundary

Next.js uses `output: "standalone"`. Dynamic analysis and orchard routes remain
server-rendered on request; this application is not statically exported.

Reader credentials and Spreadsheet identifiers are injected only at runtime.
They must not be build arguments, image environment values, `NEXT_PUBLIC_`
variables, build logs, or static artifacts. The browser must never receive a
service-account private key. The normalized Prediction Master Writer
credentials are outside the application runtime boundary.

The service reads Input and Prediction Master data through read-only server
repositories. Authentication failure must not fall back automatically to the
anonymous GViz path. Input data must not be embedded in an image or a static
deployment artifact.

## Container

The container uses an official Node.js 20 image and a multi-stage build. The
runtime contains the Next.js standalone output, static assets, and `public`
assets when present. It runs as the image's non-root `node` user, listens on
`0.0.0.0:8080`, and starts `server.js` directly. Development dependencies stay
in build stages.

The Docker context excludes Git history, local build output, dependency
directories, environment files, credential-like JSON files, private-key files,
logs, temporary files, and local IDE settings.

## Health check

`GET /api/health` returns only `{ "status": "ok" }`. It does not access Input,
Prediction Master data, credentials, environment values, or write paths. When
IAP is configured, the endpoint is protected with the rest of the application.

## GitHub Pages retirement

GitHub Pages only serves static artifacts and cannot provide the request-time
server and secret boundary required by the dynamic analysis routes. The Pages
workflow also expected an `out` directory that the server build does not
produce, and the old configuration referenced a different repository name.
The Pages deployment workflow is therefore removed. The regular verification
workflow retains its existing permissions and additionally builds the image
without credentials; it does not log in to a registry or push an image.

## Follow-up operations

Cloud Billing, Artifact Registry, Cloud Run, Secret Manager, IAP, OAuth, IAM,
allowed users, deployment, and budget alerts are handled by separate operations
issues. Production deployment and removal of Input's anonymous Viewer access
require their own user approvals and successful authenticated-read regression.
