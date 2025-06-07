**Product Requirements Document (PRD)**

---

## Product Name: FleetCore API

FleetCore API is a serverless backend-as-a-service for logistics and fleet management, built on the Cloudflare Developer Platform. It features real-time task dispatching, state tracking, and developer-facing APIs, with modular support for authentication, task lifecycle management, and auto-assignment.

---

## 1. Vision & Overview

FleetCore enables developers to launch logistics and fleet-based applications quickly without rebuilding core backend services. It is a modular platform that supports real-time job assignment, task tracking, location awareness, and optimized fleet management via simple APIs.

The API is publicly accessible and built for developer self-service.

### Use Cases

* **Courier Aggregator App**: A marketplace dispatches jobs to available riders across multiple courier services.
* **Last-Mile Delivery**: E‑commerce integrates local drop-offs with ETA and proof-of-delivery.
* **On-Demand Field Services**: Technicians are dispatched to client sites for repairs or inspections.
* **Freight & Equipment Hauling**: Businesses assign jobs based on vehicle type (e.g., `truck_small` for pallets).
* **Gig-Economy Tasking**: Errands, surveys, or one-off gigs managed via task lifecycle APIs.

---

## 2. Target Audience

* **Developers**: Integrate FleetCore APIs to manage tasks, riders, and billing within their apps. They operate in a **multi-tenant** context—each developer’s data is isolated and secure.
* **Riders**: Contractors or employees managed by developers. They register, update status/location, and accept tasks via API or SDK.
* **Admins (optional)**: External dashboards consume FleetCore APIs for operational insights and reporting.

> **Security**: Strict tenant isolation; all requests validated against developer credentials. No cross-tenant data visibility.

---

## 3. Guiding Principles

* **Developer Experience First**: 5‑minute setup to dispatch the first task.
* **Modular**: Enable/disable features per tenant.
* **Secure by Default**: RBAC, rate-limits, and strong isolation.
* **Extensible**: Custom metadata, webhooks, and SDKs.
* **Observable**: Real-time and historical metrics via APIs and dashboard.

---

## 4. Architecture

Built entirely on the [Cloudflare Developer Platform](https://developers.cloudflare.com):

* **Workers**: Stateless APIs, Hono framework
* **D1**: Normalized SQL storage for tasks, riders, keys
* **Durable Objects**: Per-task and per-rider state & WebSocket brokers
* **KV**: Caching and feature flags
* **Queues**: Asynchronous workflows (auto-assignment, webhooks)
* **WebSockets**: Bi-directional real-time streams
* **Stripe** (or equivalent): Subscription and usage billing

> **Future**: Migrate geospatial queries to **PostgreSQL + PostGIS** for advanced indexing and search.

---

## 5. Core Modules & Features

### 5.1 Authentication & Tenant Management

* **Developer Signup**: POST `/register` (email/password, OAuth)
* **API Keys**: POST `/apikeys` scoped by roles (`admin`, `read-only`, `rider`), optional expiration.
* **Tenant Isolation**: All endpoints enforce `X-Api-Key`; maps to a single `developer_id`.

#### 5.1.1 Usage & Billing

* **Metrics**: Tasks created, assignment calls, rider pings, status updates.
* **Reporting API**: GET `/usage?period=monthly`
* **Billing**: Usage posted to Stripe; tiers: Free, PAYG, Enterprise.

---

### 5.2 Rider Management

#### 5.2.1 Rider Profile & Vehicle Types

* **Create Rider**: POST `/riders`

  * Fields: `name`, `phone`, `email` (optional), `vehicle_type` (enum: `motorcycle`, `bicycle`, `truck_small`, `truck_large`, `car`, `foot`), `tags` (e.g., `cold_chain`).
* **Validation**: `vehicle_type` must be from enum; `phone` format enforced.

#### 5.2.2 Presence & Location

* PATCH `/riders/:id/presence` (`online`, `offline`, `busy`, `available`)
* PATCH `/riders/:id/location` (`latitude`, `longitude`, optional `accuracy`, `timestamp`)
* **Durable Object**: Manages rider state and WebSocket channel.

#### 5.2.3 Query Available Riders

* GET `/riders/available?lat={}&lng={}&radius={}`

  * Filters: availability, `vehicle_type`, `tags`.
  * Returns sorted list by distance and custom weights.

---

### 5.3 Task Lifecycle Management

#### 5.3.1 Task Creation

* **Endpoint**: POST `/tasks`
* **Required Payload**:

  ```json
  {
    "description": "Deliver package to client",
    "auto_assign": true,
    "waypoints": [
      {
        "latitude": 6.5244,
        "longitude": 3.3792,
        "address": "123 Lagos St, Lagos",
        "type": "pickup",
        "description": "Pick up package at warehouse",
        "time_window": {"start": "2025-06-10T08:00:00Z", "end": "2025-06-10T09:00:00Z"}
      },
      {
        "latitude": 6.6000,
        "longitude": 3.3500,
        "address": "456 Ikoyi Ave, Lagos",
        "type": "destination",
        "description": "Deliver package to customer",
        "priority": "urgent"
      }
    ],
    "metadata": {"fragile": true},
    "webhook_url": "https://dev.app/webhook"
  }
  ```
* **Fields**:

  * `description`: string
  * `auto_assign`: boolean
  * `waypoints`: array (min 2 items; max 1 `pickup`, max 1 `destination`, rest `stop`)

    * Each waypoint: `latitude` (float), `longitude` (float), `address` (string), `type` (`pickup|stop|destination`), `description` (string), optional `time_window`, `priority`.
  * `metadata`: object (optional)
  * `webhook_url`: string (optional)
* **Validation**:

  * `waypoints.length >= 2`
  * Exactly one of type `pickup` and one `destination`.
  * All coordinates valid (lat between -90 and 90, lng between -180 and 180).
  * `address` must be non-empty string.

> **Schema Population**: System extracts `pickup` and `destination` from waypoints to populate top-level fields (`pickup_lat`, `pickup_lng`, `pickup_address`, `destination_lat`, `destination_lng`, `destination_address`) for efficient querying.

#### 5.3.2 Manual Assignment Flow

* GET `/tasks/:id/available` – Returns candidate riders based on criteria.
* PATCH `/tasks/:id/assign` with `{ "rider_id": "..." }`

#### 5.3.3 Task Query & Update

* GET `/tasks` – Filters: status, time range, proximity, metadata.
* GET `/tasks/:id` – Full task object, waypoints, history.
* PATCH `/tasks/:id` – Update `description`, `waypoints`, `ETA` (if not started).
* DELETE `/tasks/:id` – Cancel if status in `[created, assigned]`.

#### 5.3.4 Status Transitions & Real-Time Stream

* PATCH `/tasks/:id/status` – Allowed: `created`, `assigned`, `accepted`, `en_route`, `arrived`, `completed`, `cancelled`.
* **Durable Object**: Dedicated per-task channel. Subscribe via WebSocket GET `/tasks/:id/realtime` to receive:

  * Status updates
  * Rider location pings
  * ETA and route updates

---

### 5.4 Auto-Assignment Engine

* **Queue**: Tasks with `auto_assign=true` are enqueued.
* **Consumer**: Worker reads queue, fetches task DO state, and filters riders by availability, proximity, `vehicle_type`, `tags`.
* **Offer Workflow**:

  1. Emit offer to rider via WebSocket/notification.
  2. Start timeout (configurable, e.g., 60s).
  3. On accept: assign and update task status.
  4. On decline/timeout: retry next candidate up to N times.
  5. Exhausted: mark `assignment_failed` and notify developer.

---

### 5.5 Notifications & Webhooks

* **Events**: `task.created`, `task.assigned`, `task.status_changed`, `rider.location_updated`, `assignment_failed`.
* **Delivery**: HTTP POST to developer’s `webhook_url` or via DO-backed WebSocket.
* **Reliability**: Exponential backoff, dead-letter queue, retry limits.

---

## 6. Future Enhancements

* **PostGIS Migration**: Geospatial indexing, complex geofencing, batch routing.
* **Admin Dashboard**: Cloudflare Pages UI for metrics, logs, and tenant management.
* **SDKs**: Flutter, React Native, Node.js; include DO & WebSocket wrappers.
* **Routing & ETA**: External map API integrations; dynamic ETA recalculation on reroutes.
* **Analytics**: Heatmaps, SLA compliance, rider performance dashboards.

---

## 7. Testing & CI Requirements

* **Unit Tests**: Validate payload schemas, route handlers, middleware.
* **Integration Tests**: Simulate queue workflows, DO state changes, webhook end-to-end.
* **Security Tests**: Ensure tenant isolation, API key scopes, rate limits.
* **CI Pipeline**: On commit, run lint, tests, and smoke tests with Wrangler.

---

---

## 8. Step-by-Step Implementation Guide

This section provides a detailed roadmap for an LLM or developer to implement FleetCore API from start to finish.

### 8.1 Project Setup

1. **Initialize Repository**: Create a new Git repo and initialize with a README, .gitignore, and LICENSE.
2. **Install Wrangler**: Set up Cloudflare Workers CLI (`npm i -g wrangler`).
3. **Scaffold Worker Project**: Run `wrangler init fleetcore-api --template=hono`.
4. **Configure Environment**: Add `wrangler.toml` with account ID, zone ID, and preview settings. Set environment variables for D1 database, Durable Objects namespace, Stripe keys, and Turnstile.

### 8.2 Database Schema & D1 Setup

1. **Define Tables**: Create SQL migrations for:

   * `developers` (id, email, hashed\_password, created\_at)
   * `api_keys` (id, developer\_id, prefix, key\_hash, scopes, expires\_at)
   * `riders` (id, developer\_id, name, phone, email, vehicle\_type, tags, created\_at)
   * `tasks` (id, developer\_id, description, auto\_assign, metadata, pickup\_lat, pickup\_lng, pickup\_address, destination\_lat, destination\_lng, destination\_address, created\_at, status)
   * `waypoints` (id, task\_id, latitude, longitude, address, type, description, time\_window\_start, time\_window\_end, priority)
2. **Apply Migrations**: Use Wrangler to apply D1 migrations.

### 8.3 Authentication & Middleware

1. **Developer Signup Route**: Implement POST `/register` to store new developers with password hashing (bcrypt).
2. **API Key Generation**: POST `/apikeys` to issue new keys, hash secrets, and return prefix + secret once.
3. **Auth Middleware**: Create Hono middleware to extract `X-Api-Key`, hash incoming key, verify against `api_keys.key_hash`, load `developer_id` into context.
4. **RBAC Enforcement**: Middleware to check scopes on protected routes.

### 8.4 Rider Management Endpoints

1. **POST `/riders`**: Validate payload, insert into `riders`. Ensure `vehicle_type` enum validated.
2. **PATCH `/riders/:id/presence`**: Update DO state and D1 record.
3. **PATCH `/riders/:id/location`**: Update DO state and optionally write to D1.
4. **DO for Riders**: Define a Durable Object class `RiderStateDo` that holds presence & location and exposes WebSocket upgrade handler.
5. **GET `/riders/available`**: Query D1 with bounding box, filter by status/tags, then sort by Haversine distance on DO cache or parameters.

### 8.5 Task Management Endpoints

1. **POST `/tasks`**: Validate JSON schema (use Zod or Ajv), enforce waypoint rules (>=2, exactly one pickup and destination), extract pickup/destination fields, wrap inserts in transaction, enqueue if `auto_assign`.
2. **GET `/tasks` & `/tasks/:id`**: Paginate and fetch relational data from D1, include waypoints.
3. **PATCH `/tasks/:id`**: Validate allowed fields, enforce status preconditions.
4. **DELETE `/tasks/:id`**: Allow cancel if status in allowed list.
5. **Durable Object for Tasks**: Create `TaskDo` that maintains WebSocket clients and broadcasts events.

### 8.6 Auto-Assignment Engine

1. **Queue Definition**: Configure Cloudflare Queue `AUTO_ASSIGN_QUEUE`.
2. **Enqueue Task**: Within task creation handler, if `auto_assign=true`, push `{ taskId }` to queue.
3. **Worker Consumer**: Create a separate Worker script bound to the queue. On event:

   * Fetch task and waypoints from D1.
   * Query available riders (via D1 + DO peek).
   * Run ranking algorithm (proximity, vehicle\_type, tags).
   * Offer to first candidate via DO event.
   * On timeout or decline, retry next until retries exhausted.

### 8.7 Notifications & Webhooks

1. **Webhook Queue**: Define `WEBHOOK_QUEUE` for reliable delivery.
2. **Event Publisher**: After each task/rider event, serialize payload and push to `WEBHOOK_QUEUE`.
3. **Webhook Consumer**: Worker script that reads from queue, does HTTP POST to developer’s `webhook_url` with HMAC signature, retries on failure.

### 8.8 Billing Integration

1. **Usage Logger**: Implement middleware to increment counters in KV or D1 for each billable event.
2. **Periodic Billing Job**: Scheduled Worker (Cron trigger) runs daily/monthly to read usage, generate Stripe invoices or usage records.
3. **Webhook for Billing**: Notify developers via email or webhook of upcoming charges.

### 8.9 Testing & CI

1. **Unit Tests**: Set up Jest or Vitest for route handlers, middleware, and utility functions.
2. **Integration Tests**: Use Miniflare to simulate Workers environment; test end-to-end flows (task creation, assignment, WebSocket messages).
3. **DO Testing**: Mock Durable Objects and test state transitions.
4. **CI Pipeline**: GitHub Actions to run lint, tests, and `wrangler publish --dry-run` on every PR.

### 8.10 Documentation & SDKs

1. **OpenAPI Spec**: Auto-generate from route definitions using tools like `openapi-comment-parser`.
2. **SDK Generation**: Use OpenAPI to generate TypeScript/Node SDK.
3. **Examples**: Include sample cURL, Postman collection, and minimal React or Flutter demo.

---
