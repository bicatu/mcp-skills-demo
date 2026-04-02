# REST API Reference

Base URL: `http://localhost:3000` (override with `SERVICE_URL` env var).

All responses are JSON. Errors return `{ "error": "message" }`.

---

## Specialties

| Method | Path | Query Params | Description |
|--------|------|-------------|-------------|
| `GET` | `/api/specialties` | — | List all specialties |
| `GET` | `/api/specialties/:id` | — | Get one specialty |

**Specialty object**:
```json
{
  "id": "spec-1",
  "name": "Cardiology",
  "description": "Heart and cardiovascular system specialist"
}
```

---

## Doctors

| Method | Path | Query Params | Description |
|--------|------|-------------|-------------|
| `GET` | `/api/doctors` | `name`, `specialtyId` | List doctors (all params optional) |
| `GET` | `/api/doctors/:id` | — | Get one doctor |
| `GET` | `/api/doctors/:id/slots` | `date` (required, `YYYY-MM-DD`) | Get time slots for a date |

**Doctor object**:
```json
{
  "id": "doc-3",
  "name": "Dr. Sarah Chen",
  "specialtyId": "spec-1",
  "availableDays": ["Monday", "Wednesday", "Friday"],
  "workingHoursStart": "09:00",
  "workingHoursEnd": "17:00",
  "slotDurationMinutes": 30,
  "bio": "..."
}
```

**TimeSlot object**:
```json
{
  "startTime": "2026-04-01T09:00:00.000Z",
  "endTime": "2026-04-01T09:30:00.000Z",
  "available": true
}
```

---

## Patients

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/patients` | List all patients |
| `GET` | `/api/patients/:id` | Get one patient |
| `POST` | `/api/patients` | Create a patient |

**Patient object**:
```json
{
  "id": "pat-1",
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "phone": "555-0101",
  "dateOfBirth": "1985-03-15"
}
```

**Seed patient IDs**: `pat-1` through `pat-5`.

---

## Appointments

| Method | Path | Query Params | Description |
|--------|------|-------------|-------------|
| `GET` | `/api/appointments` | `patientId`, `doctorId`, `status`, `date` | List appointments (all optional) |
| `GET` | `/api/appointments/:id` | — | Get one appointment |
| `POST` | `/api/appointments` | — | Book an appointment |
| `PATCH` | `/api/appointments/:id/cancel` | — | Cancel an appointment |
| `PATCH` | `/api/appointments/:id/complete` | — | Mark as completed |

**Status values**: `scheduled` | `cancelled` | `completed`

**POST /api/appointments body**:
```json
{
  "patientId": "pat-1",
  "doctorId": "doc-3",
  "dateTime": "2026-04-10T10:00:00",
  "reason": "Annual check-up"
}
```

**Appointment object**:
```json
{
  "id": "apt-1",
  "patientId": "pat-1",
  "doctorId": "doc-3",
  "dateTime": "2026-04-10T10:00:00",
  "durationMinutes": 30,
  "reason": "Annual check-up",
  "status": "scheduled",
  "notes": null
}
```

---

## ID Formats

| Entity | Format | Example |
|--------|--------|---------|
| Specialty | `spec-{n}` | `spec-1` |
| Doctor | `doc-{n}` | `doc-3`, `doc-12` |
| Patient | `pat-{n}` | `pat-1`, `pat-5` |
| Appointment | `apt-{n}` | `apt-1` |
