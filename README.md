# MCP Medical Appointments Demo

> A working reference for the [Model Context Protocol](https://modelcontextprotocol.io/) — tools, resources, prompts, elicitation, sampling, and completion — built around a medical appointment scheduling domain.

Built with [TypeScript](https://www.typescriptlang.org/), [Hono](https://hono.dev/), [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk), and [Zod](https://zod.dev/).

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [REST API Endpoints](#rest-api-endpoints)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Domain Model](#domain-model)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

## Features

### MCP Server Primitives

| Primitive | Name | Description |
|-----------|------|-------------|
| **Tool** | `search_doctors` | Search doctors by name or specialty |
| **Tool** | `get_available_slots` | Get available time slots for a doctor on a date |
| **Tool** | `book_appointment` | Book an appointment (uses **elicitation** for confirmation) |
| **Tool** | `cancel_appointment` | Cancel an appointment (uses **elicitation** for confirmation) |
| **Tool** | `list_appointments` | List appointments with filters |
| **Tool** | `recommend_specialist` | Symptom-based specialist recommendation (uses **sampling**) |
| **Resource** | `specialties://list` | Static list of all medical specialties |
| **Resource** | `doctor://{doctorId}/profile` | Dynamic doctor profile with template |
| **Resource** | `patient://{patientId}/summary` | Patient info + appointment history |
| **Resource** | `appointment://{appointmentId}` | Full appointment details |
| **Prompt** | `schedule-appointment` | Guided appointment scheduling workflow (with **completion**) |
| **Prompt** | `patient-history` | Patient history review (with **completion**) |
| **Prompt** | `triage-symptoms` | Symptom triage and specialist recommendation |

### MCP Client Features

| Feature | How It's Used |
|---------|---------------|
| **Elicitation** | `book_appointment` and `cancel_appointment` ask the user to confirm before proceeding |
| **Sampling** | `recommend_specialist` uses LLM sampling to match symptoms to specialties |
| **Roots** | Server registers a root for the medical appointments workspace |
| **Completion** | Prompts use `completable()` for auto-completing specialty names and patient IDs |

## Quick Start

### Prerequisites

- Node.js >= 22.0.0
- VS Code with GitHub Copilot (for MCP integration)

### 1. Install and start the REST API

```bash
npm install
npm run dev:service
```

You should see:

```
Bootstrapped: 8 specialties, 12 doctors, 5 patients
Medical Appointment Service running on http://localhost:3000
```

### 2. Connect the MCP Server in VS Code

The `.vscode/mcp.json` file is already configured. VS Code will automatically detect and offer to start the MCP server. Alternatively, run it manually:

```bash
npm run dev:mcp
```

### 3. Try it out

In VS Code's Copilot Chat (Agent mode), try:

- _"Search for cardiologists"_
- _"What slots does Dr. Sarah Chen have available next Monday?"_
- _"Book an appointment with doc-3 for patient pat-1"_
- _"Show me Alice Johnson's appointment history"_
- _"I've been having severe headaches and dizziness — what specialist should I see?"_

Or use the prompts from the prompt picker:

- **Schedule Appointment** — guided scheduling workflow
- **Patient History** — review a patient's visits
- **Triage Symptoms** — symptom-based specialist matching

## Architecture

```
┌─────────────────┐     stdio      ┌───────────────────┐     HTTP      ┌──────────────────┐
│   VS Code /     │◄──────────────►│   MCP Server      │─────────────►│  Hono REST API   │
│   MCP Client    │                │   (TypeScript)    │  localhost    │  (localhost:3000) │
└─────────────────┘                └───────────────────┘              └──────────────────┘
                                     Tools, Resources,                  In-memory store
                                     Prompts                            + JSON bootstrap
```

The project uses a **two-process design**:

1. **Hono REST API** — HTTP service with an in-memory data store, bootstrapped from JSON seed files in `data/`.
2. **MCP Server** — Connects via stdio and exposes the REST API through MCP primitives (tools, resources, prompts).

The MCP server never touches the data store directly — it calls the REST API through an HTTP client, keeping the two layers cleanly separated.

## REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/specialties` | List all specialties |
| `GET` | `/api/specialties/:id` | Get specialty by ID |
| `GET` | `/api/doctors` | List doctors (filters: `?specialtyId=`, `?name=`) |
| `GET` | `/api/doctors/:id` | Get doctor by ID |
| `GET` | `/api/doctors/:id/slots?date=YYYY-MM-DD` | Get available slots |
| `GET` | `/api/patients` | List all patients |
| `GET` | `/api/patients/:id` | Get patient by ID |
| `POST` | `/api/patients` | Create a patient |
| `GET` | `/api/appointments` | List appointments (filters: `?patientId=`, `?doctorId=`, `?status=`, `?date=`) |
| `GET` | `/api/appointments/:id` | Get appointment by ID |
| `POST` | `/api/appointments` | Book an appointment |
| `PATCH` | `/api/appointments/:id/cancel` | Cancel an appointment |
| `PATCH` | `/api/appointments/:id/complete` | Complete an appointment |

## Project Structure

```
mcp-demo/
├── data/
│   ├── specialties.json      # 8 medical specialties
│   ├── doctors.json           # 12 doctors across specialties
│   └── patients.json          # 5 sample patients
├── src/
│   ├── types.ts               # Shared domain types
│   ├── service/
│   │   ├── store.ts           # In-memory data store
│   │   ├── app.ts             # Hono app composition
│   │   ├── main.ts            # Service entry point
│   │   └── routes/            # REST route handlers
│   └── mcp/
│       ├── api-client.ts      # HTTP client for the REST API
│       ├── tools.ts           # MCP tool registrations
│       ├── resources.ts       # MCP resource registrations
│       ├── prompts.ts         # MCP prompt registrations
│       └── server.ts          # MCP server entry point
├── .vscode/
│   └── mcp.json               # VS Code MCP server config
├── package.json
└── tsconfig.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:service` | Start the Hono REST API with hot reload |
| `npm run dev:mcp` | Start MCP server in stdio mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Type-check without emitting files |

## Domain Model

| Entity | Description |
|--------|-------------|
| **Specialty** | Medical specialty (Cardiology, Dermatology, etc.) |
| **Doctor** | Has a specialty, available days, working hours, and slot duration |
| **Patient** | Name, email, phone, date of birth |
| **Appointment** | Links a patient to a doctor at a specific date/time with a reason and status |
| **TimeSlot** | Available or booked time window for a doctor on a given day |

## Configuration

The REST API listens on port **3000** by default. The MCP server communicates with the API over `http://localhost:3000` and connects to VS Code via **stdio**.

Seed data (specialties, doctors, patients) is loaded from the `data/` directory on startup. Edit those JSON files to customize the demo dataset.

## Contributing

Contributions are welcome. Fork the repo, create a feature branch, and open a pull request.

## License

MIT
