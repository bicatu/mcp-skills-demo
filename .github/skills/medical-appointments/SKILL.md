---
name: medical-appointments
description: "Manage medical appointments: find doctors by specialty or name, check available time slots, book or cancel appointments (with explicit confirmation), list appointments with filters, review patient history, triage symptoms to recommend the right specialist, and run guided end-to-end scheduling workflows. Use when asked to find a doctor, book an appointment, cancel an appointment, check availability, review patient records, triage symptoms, or get a specialist recommendation."
compatibility: "Requires the medical appointments REST service running at http://localhost:3000 (configurable via SERVICE_URL). Start it with: npm run dev:service"
---

# Medical Appointments

Provides medical appointment scheduling capabilities by querying the REST service directly. Mirrors the functionality of the `medical-appointments` MCP server.

> **Service base URL**: `http://localhost:3000` — override with the `SERVICE_URL` environment variable.

See [references/api.md](references/api.md) for full endpoint details.

## Capabilities

| Workflow | Description |
|----------|-------------|
| Find Doctors | Search by specialty or name |
| Check Available Slots | Get open time slots for a doctor on a specific date |
| Book Appointment | Confirm details, then create an appointment |
| Cancel Appointment | Confirm intent, then cancel an existing appointment |
| List Appointments | Filter by patient, doctor, status, or date |
| Recommend Specialist | Match patient symptoms to the right specialty |
| Schedule Appointment | End-to-end guided booking workflow |
| Patient History | Review a patient's full visit record with summary |
| Triage Symptoms | Structured symptom analysis and specialist routing |

---

## Workflows

### Find Doctors

1. If a specialty name is given, `GET /api/specialties` to resolve the name to an ID (case-insensitive match).
   - If no match exists, list available specialties and ask the user to choose one.
2. `GET /api/doctors?specialtyId={id}&name={query}` (both params optional).
3. Display each doctor: name, specialty, available days, slot duration (minutes), bio.

### Check Available Slots

1. `GET /api/doctors/{doctorId}/slots?date={YYYY-MM-DD}`.
2. Filter to slots where `available: true`.
3. Display each as `HH:MM – HH:MM`. State total available vs total slots.
4. If zero available, note whether the doctor works on that day.

### Book Appointment

**Required inputs**: patient ID, doctor ID, appointment date/time (ISO 8601), reason.

1. Fetch confirmation details in parallel:
   - `GET /api/patients/{patientId}` — patient name
   - `GET /api/doctors/{doctorId}` — doctor name, specialty, slot duration
2. **Ask the user to confirm** before proceeding. Present:
   - Patient name, doctor name, specialty, date, time, duration, reason
3. On confirmation: `POST /api/appointments` with body `{"patientId","doctorId","dateTime","reason"}`.
4. Return the created appointment ID and full details.
5. On refusal: abort without making any API call.

> **Note**: The MCP server uses native elicitation (a UI confirmation dialog). This skill asks for confirmation through conversation. See [Limitations](#limitations) in the README.

### Cancel Appointment

**Required input**: appointment ID.

1. `GET /api/appointments/{appointmentId}` — retrieve current details.
2. Fetch patient and doctor names for a readable summary.
3. **Ask the user to confirm** cancellation. Show: appointment ID, patient, doctor, scheduled date/time, reason.
4. On confirmation: `PATCH /api/appointments/{appointmentId}/cancel`.
5. Return confirmation of cancellation with original scheduled details.
6. On refusal: leave the appointment unchanged.

> **Note**: Same elicitation limitation as Book Appointment. See [Limitations](#limitations) in the README.

### List Appointments

All filters are optional.

1. Build query string from any provided filters: `patientId`, `doctorId`, `status` (`scheduled` | `cancelled` | `completed`), `date` (`YYYY-MM-DD`).
2. `GET /api/appointments?{filters}`.
3. Display each as: `{id} | {date} {time} | status: {status} | {reason}`.

### Recommend Specialist

1. `GET /api/specialties` — load all specialties with descriptions.
2. Analyze the patient's symptoms against each specialty description using your own reasoning.
3. Identify the single most appropriate specialty; explain the reasoning briefly.
4. `GET /api/doctors?specialtyId={id}` — list matching doctors.
5. Present: recommended specialty, rationale, and the available doctors.

> **Note**: The MCP server calls a sub-LLM (sampling) for this step. The skill uses the agent's own reasoning directly, producing an equivalent result. See [Limitations](#limitations) in the README.

### Schedule Appointment (Guided Workflow)

End-to-end booking for a requested specialty and preferred date.

1. `GET /api/specialties` — load all specialties.
2. Match the requested specialty (case-insensitive). If no match, list available options and ask the user to choose.
3. `GET /api/doctors?specialtyId={id}` — list doctors in the specialty with bios and available days.
4. For each doctor, `GET /api/doctors/{id}/slots?date={preferredDate}` — check open slots on the preferred date.
5. Present doctors that have availability, with their open time slots.
6. Ask the user to select a doctor and time slot.
7. Ask for the patient ID if not already known (available patient IDs: `pat-1` through `pat-5`; or `GET /api/patients` to list them).
8. Ask for the reason for the visit.
9. Run the **Book Appointment** workflow above.

### Patient History

1. `GET /api/patients/{patientId}` — retrieve patient info.
2. `GET /api/appointments?patientId={patientId}` — get the full appointment list.
3. Summarize:
   - Counts: total, scheduled, completed, cancelled.
   - Chronological list: date, doctor ID, status, reason.
   - Highlight upcoming scheduled appointments.
   - If last completed appointment was more than 6 months ago (or none exists), recommend scheduling a check-up.

### Triage Symptoms

1. `GET /api/specialties` — load all specialties with descriptions.
2. Analyze the reported symptoms against the specialty descriptions. Ask clarifying questions if the symptoms are ambiguous or could map to multiple specialties.
3. Identify the most appropriate specialty with a brief rationale.
4. Run **Recommend Specialist** to surface matching doctors.
5. Offer to start the **Schedule Appointment** workflow if the patient wants to book.
