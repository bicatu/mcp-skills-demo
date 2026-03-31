import { z } from "zod";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceClient } from "./api-client.js";

export function registerPrompts(server: McpServer, client: ServiceClient) {
  // ── 1. schedule-appointment ──
  server.registerPrompt(
    "schedule-appointment",
    {
      title: "Schedule Appointment",
      description:
        "Guided workflow to schedule a medical appointment. Provides specialty context and helps find available doctors and time slots.",
      argsSchema: {
        specialty: completable(
          z.string().describe("Medical specialty name"),
          async (value) => {
            const specialties = await client.getSpecialties();
            return specialties
              .map((s) => s.name)
              .filter((name) => name.toLowerCase().startsWith(value.toLowerCase()));
          }
        ),
        preferredDate: z.string().describe("Preferred date in YYYY-MM-DD format"),
      },
    },
    async ({ specialty, preferredDate }) => {
      const specialties = await client.getSpecialties();
      const match = specialties.find(
        (s) => s.name.toLowerCase() === specialty.toLowerCase()
      );

      if (!match) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `I'd like to schedule an appointment with a ${specialty} specialist on ${preferredDate}, but that specialty wasn't found. Available specialties are: ${specialties.map((s) => s.name).join(", ")}. Please help me choose the right one.`,
              },
            },
          ],
        };
      }

      const doctors = await client.getDoctors({ specialtyId: match.id });
      const doctorInfo = doctors
        .map((d) => `- ${d.name} (ID: ${d.id}) — available ${d.availableDays.join(", ")}, ${d.slotDurationMinutes}min slots`)
        .join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "resource" as const,
              resource: {
                uri: "specialties://list",
                mimeType: "application/json",
                text: JSON.stringify(specialties, null, 2),
              },
            },
          },
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I'd like to schedule an appointment with a **${match.name}** specialist on **${preferredDate}**.

${match.description}

Available doctors in ${match.name}:
${doctorInfo}

Please help me:
1. Check available time slots for these doctors on ${preferredDate} using the get_available_slots tool
2. Recommend a suitable slot
3. Book the appointment using the book_appointment tool

Patients available: use the patient resources to look up patient information if needed.`,
            },
          },
        ],
      };
    }
  );

  // ── 2. patient-history ──
  server.registerPrompt(
    "patient-history",
    {
      title: "Patient History",
      description:
        "Review a patient's appointment history and provide a summary.",
      argsSchema: {
        patientId: completable(
          z.string().describe("Patient ID (e.g. 'pat-1')"),
          async (value) => {
            const patients = await client.getPatients();
            return patients
              .filter((p) => p.id.startsWith(value) || p.name.toLowerCase().includes(value.toLowerCase()))
              .map((p) => p.id);
          }
        ),
      },
    },
    async ({ patientId }) => {
      const patient = await client.getPatient(patientId);
      const appointments = await client.getAppointments({ patientId });

      const scheduled = appointments.filter((a) => a.status === "scheduled");
      const completed = appointments.filter((a) => a.status === "completed");
      const cancelled = appointments.filter((a) => a.status === "cancelled");

      const appointmentSummary = appointments.length > 0
        ? appointments
            .map((a) => {
              const dt = new Date(a.dateTime);
              return `- ${a.id}: ${dt.toLocaleDateString()} — ${a.status} — ${a.reason}`;
            })
            .join("\n")
        : "No appointments on record.";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "resource" as const,
              resource: {
                uri: `patient://${patientId}/summary`,
                mimeType: "application/json",
                text: JSON.stringify({ patient, appointments }, null, 2),
              },
            },
          },
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Please review the appointment history for **${patient.name}** (${patient.email}).

**Summary**: ${appointments.length} total appointments — ${scheduled.length} scheduled, ${completed.length} completed, ${cancelled.length} cancelled.

**Appointments:**
${appointmentSummary}

Please provide:
1. A brief overview of the patient's visit history
2. Any upcoming scheduled appointments
3. Recommendations (e.g., if it's been a long time since their last visit, suggest scheduling a check-up)`,
            },
          },
        ],
      };
    }
  );

  // ── 3. triage-symptoms ──
  server.registerPrompt(
    "triage-symptoms",
    {
      title: "Triage Symptoms",
      description:
        "Structured symptom triage workflow. Analyzes symptoms and guides the user toward the appropriate specialist.",
      argsSchema: {
        symptoms: z.string().describe("Description of the patient's symptoms"),
      },
    },
    async ({ symptoms }) => {
      const specialties = await client.getSpecialties();
      const specialtyList = specialties.map((s) => `- **${s.name}**: ${s.description}`).join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "resource" as const,
              resource: {
                uri: "specialties://list",
                mimeType: "application/json",
                text: JSON.stringify(specialties, null, 2),
              },
            },
          },
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `A patient reports the following symptoms: **${symptoms}**

Available medical specialties:
${specialtyList}

Please:
1. Analyze the symptoms and determine the most appropriate specialty
2. Use the recommend_specialist tool to find matching doctors
3. Ask clarifying questions if the symptoms are ambiguous
4. Once a specialist is identified, help the patient schedule an appointment using the schedule workflow

Important: This is for informational purposes only and does not replace professional medical advice.`,
            },
          },
        ],
      };
    }
  );
}
