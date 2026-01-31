# Production-Ready Asynchronous Payment Gateway

This project is a production-grade payment gateway simulation inspired by real-world systems such as Stripe, Razorpay, and PayPal.

It is designed to demonstrate reliable, scalable, and fault-tolerant backend architecture using asynchronous processing, background workers, secure webhooks, idempotency, and an embeddable checkout SDK.

The system reflects how modern payment platforms operate in real production environments.

---

## Project Objectives

- Process payments asynchronously using background workers
- Deliver secure webhooks with retry and exponential backoff
- Prevent duplicate charges using idempotency keys
- Support full and partial refunds
- Provide an embeddable JavaScript checkout SDK
- Expose a merchant dashboard for configuration and logs
- Demonstrate production-grade system design patterns

---

## Architecture Overview

The system is composed of multiple independent services, all running via Docker Compose:

- API Service – Handles payment, refund, and webhook APIs
- Worker Service – Processes payments, refunds, and webhook deliveries asynchronously
- PostgreSQL – Persistent storage for all transactional data
- Checkout Service – Hosts the embeddable checkout UI and SDK
- Dashboard – Merchant-facing UI for configuration, logs, and documentation

Each service is isolated and designed for scalability and reliability.

---

## Core Features

### Asynchronous Payment Processing

- Payments are created with a `PENDING` status
- Background workers process payments asynchronously
- Simulated delays mimic real payment gateways
- Payment success or failure is determined by predefined rules

---

### Webhook System

- HMAC-SHA256 signature verification
- Signature generated from the exact JSON payload
- Automatic retry with exponential backoff
- Maximum of 5 retry attempts
- Delivery attempts and responses stored in the database
- Manual retry supported via dashboard

---

### Refund Management

- Supports full and partial refunds
- Refunds processed asynchronously
- Prevents refund amount from exceeding payment total
- Refund lifecycle tracked with timestamps

---

### Idempotency Keys

- Prevents duplicate charges on network retries
- Cached responses returned for repeated requests
- Keys automatically expire after 24 hours

---

### Embeddable Checkout SDK

- Drop-in JavaScript SDK
- Modal-based checkout using iframe
- No page redirects
- Cross-origin communication using postMessage
- Works on desktop and mobile browsers

---

## Tech Stack

Backend:
- Java
- Spring Boot

Frontend:
- React (Dashboard and Checkout)

Database:
- PostgreSQL

Infrastructure:
- Docker
- Docker Compose

---

## Running the Project Locally

### Prerequisites

- Docker
- Docker Compose
- Node.js (for dashboard and SDK development)

---

### Start All Services

```bash
docker-compose up --build
```

---

## Service URLs

Once all services are running, they will be available at:

- **API**: http://localhost:8000
- **Checkout**: http://localhost:3001
- **Dashboard**: http://localhost:3002

---

## API Endpoints

### Create Payment
POST /api/v1/payments

- Supports idempotency
- Returns immediately with `PENDING` status

### Capture Payment
```
POST /api/v1/payments/{payment_id}/capture
```

### Create Refund
```
POST /api/v1/payments/{payment_id}/refunds
```

### Get Refund
```
GET /api/v1/refunds/{refund_id}
```

### Webhook Logs
```
GET /api/v1/webhooks
```

### Retry Webhook
```
POST /api/v1/webhooks/{webhook_id}/retry
```

### Job Queue Status (Testing)
```
GET /api/v1/test/jobs/status
```

---

## Webhook Security

- Uses HMAC-SHA256 signatures
- Signature sent via `X-Webhook-Signature` header
- Prevents payload tampering and spoofing

---

## Testing Webhooks

A test merchant application is provided to validate:

- Signature verification
- Retry behavior
- Payload correctness

### Recommended Webhook URLs

**Mac / Windows**
http://host.docker.internal:4000/webhook

**Linux**
http://172.17.0.1:4000/webhook

---

## JavaScript SDK Usage

```html
<script src="http://localhost:3001/checkout.js"></script>

<script>
  const checkout = new PaymentGateway({
    key: 'key_test_abc123',
    orderId: 'order_xyz',
    onSuccess: (res) => console.log(res),
    onFailure: (err) => console.error(err)
  });

  checkout.open();
</script>
```

---

## What This Project Demonstrates

- Event-driven architecture
- Asynchronous background job processing
- Secure webhook delivery with retries
- Idempotent API design
- Real-world payment workflows
- Production-grade backend system design