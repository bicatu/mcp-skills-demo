import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { ServiceClient } from "./api-client.js";

export function registerTools(server: McpServer, lowLevelServer: Server, client: ServiceClient) {
  // ── 1. search_doctors ──
  server.registerTool(
    "search_doctors",
    {
      title: "Search Doctors",
      description:
        "Search for doctors by specialty name, doctor name, or both. Returns matching doctors with their details.",
      inputSchema: {
        query: z.string().optional().describe("Doctor name to search for"),
        specialtyName: z.string().optional().describe("Specialty name to filter by (e.g. 'Cardiology')"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, specialtyName }) => {
      let specialtyId: string | undefined;
      if (specialtyName) {
        const specialties = await client.getSpecialties();
        const match = specialties.find(
          (s) => s.name.toLowerCase() === specialtyName.toLowerCase()
        );
        specialtyId = match?.id;
        if (!match) {
          return {
            content: [{ type: "text", text: `No specialty found matching "${specialtyName}". Available specialties: ${specialties.map((s) => s.name).join(", ")}` }],
          };
        }
      }

      const doctors = await client.getDoctors({ specialtyId, name: query });
      if (doctors.length === 0) {
        return { content: [{ type: "text", text: "No doctors found matching your criteria." }] };
      }

      const specialties = await client.getSpecialties();
      const specMap = new Map(specialties.map((s) => [s.id, s.name]));

      const text = doctors
        .map(
          (d) =>
            `- **${d.name}** (${specMap.get(d.specialtyId) ?? d.specialtyId})\n  ID: ${d.id} | Available: ${d.availableDays.join(", ")} | Slot: ${d.slotDurationMinutes}min\n  ${d.bio}`
        )
        .join("\n\n");

      return { content: [{ type: "text", text }] };
    }
  );

  // ── 2. get_available_slots ──
  server.registerTool(
    "get_available_slots",
    {
      title: "Get Available Slots",
      description:
        "Get available appointment time slots for a specific doctor on a given date.",
      inputSchema: {
        doctorId: z.string().describe("The doctor's ID (e.g. 'doc-3')"),
        date: z.string().describe("Date in YYYY-MM-DD format"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ doctorId, date }) => {
      const [doctor, slots] = await Promise.all([
        client.getDoctor(doctorId),
        client.getAvailableSlots(doctorId, date),
      ]);

      const available = slots.filter((s) => s.available);
      if (available.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No available slots for ${doctor.name} on ${date}. The doctor may not work on this day or all slots are booked.`,
            },
          ],
        };
      }

      const lines = available.map((s) => {
        const start = new Date(s.startTime);
        const end = new Date(s.endTime);
        const fmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
        return `  ${fmt(start)} – ${fmt(end)}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Available slots for **${doctor.name}** on **${date}**:\n\n${lines.join("\n")}\n\n${available.length} slot(s) available out of ${slots.length} total.`,
          },
        ],
      };
    }
  );

  // ── 3. book_appointment (uses Elicitation) ──
  server.registerTool(
    "book_appointment",
    {
      title: "Book Appointment",
      description:
        "Book a medical appointment. Will ask the user to confirm the appointment details before booking.",
      inputSchema: {
        patientId: z.string().describe("Patient ID (e.g. 'pat-1')"),
        doctorId: z.string().describe("Doctor ID (e.g. 'doc-3')"),
        dateTime: z.string().describe("Appointment date and time in ISO 8601 format (e.g. '2026-04-01T10:00:00')"),
        reason: z.string().describe("Reason for the appointment"),
      },
    },
    async ({ patientId, doctorId, dateTime, reason }) => {
      // Fetch details for confirmation
      const [patient, doctor] = await Promise.all([
        client.getPatient(patientId),
        client.getDoctor(doctorId),
      ]);

      const specialties = await client.getSpecialties();
      const specName = specialties.find((s) => s.id === doctor.specialtyId)?.name ?? doctor.specialtyId;
      const dt = new Date(dateTime);
      const dateStr = dt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const timeStr = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

      // Try to elicit confirmation from the user
      try {
        const elicitResult = await lowLevelServer.elicitInput({
          message: `Please confirm the following appointment:\n\n• Patient: ${patient.name}\n• Doctor: ${doctor.name} (${specName})\n• Date: ${dateStr}\n• Time: ${timeStr}\n• Duration: ${doctor.slotDurationMinutes} minutes\n• Reason: ${reason}`,
          requestedSchema: {
            type: "object" as const,
            properties: {
              confirm: {
                type: "boolean" as const,
                title: "Confirm Booking",
                description: "Check to confirm this appointment",
                default: true,
              },
            },
            required: ["confirm"],
          },
        });

        if (elicitResult.action !== "accept" || !elicitResult.content?.confirm) {
          return { content: [{ type: "text", text: "Appointment booking was cancelled by the user." }] };
        }
      } catch {
        // Elicitation not supported by client — proceed without confirmation
      }

      const appointment = await client.bookAppointment({ patientId, doctorId, dateTime, reason });

      return {
        content: [
          {
            type: "text",
            text: `Appointment booked successfully!\n\n• **ID**: ${appointment.id}\n• **Patient**: ${patient.name}\n• **Doctor**: ${doctor.name} (${specName})\n• **Date**: ${dateStr} at ${timeStr}\n• **Duration**: ${appointment.durationMinutes} minutes\n• **Reason**: ${reason}`,
          },
        ],
      };
    }
  );

  // ── 4. cancel_appointment (uses Elicitation) ──
  server.registerTool(
    "cancel_appointment",
    {
      title: "Cancel Appointment",
      description:
        "Cancel an existing appointment. Will ask the user to confirm cancellation.",
      inputSchema: {
        appointmentId: z.string().describe("Appointment ID to cancel (e.g. 'apt-1')"),
      },
    },
    async ({ appointmentId }) => {
      const appointment = await client.getAppointment(appointmentId);
      const [patient, doctor] = await Promise.all([
        client.getPatient(appointment.patientId),
        client.getDoctor(appointment.doctorId),
      ]);

      const dt = new Date(appointment.dateTime);
      const dateStr = dt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const timeStr = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

      // Try to elicit cancellation confirmation
      try {
        const elicitResult = await lowLevelServer.elicitInput({
          message: `Are you sure you want to cancel this appointment?\n\n• ID: ${appointment.id}\n• Patient: ${patient.name}\n• Doctor: ${doctor.name}\n• Date: ${dateStr} at ${timeStr}\n• Reason: ${appointment.reason}`,
          requestedSchema: {
            type: "object" as const,
            properties: {
              confirm: {
                type: "boolean" as const,
                title: "Confirm Cancellation",
                description: "Check to confirm cancellation",
                default: false,
              },
            },
            required: ["confirm"],
          },
        });

        if (elicitResult.action !== "accept" || !elicitResult.content?.confirm) {
          return { content: [{ type: "text", text: "Cancellation was not confirmed. Appointment remains scheduled." }] };
        }
      } catch {
        // Elicitation not supported — proceed
      }

      const cancelled = await client.cancelAppointment(appointmentId);
      return {
        content: [
          {
            type: "text",
            text: `Appointment **${cancelled.id}** has been cancelled.\n\n• Patient: ${patient.name}\n• Doctor: ${doctor.name}\n• Was scheduled for: ${dateStr} at ${timeStr}`,
          },
        ],
      };
    }
  );

  // ── 5. list_appointments ──
  server.registerTool(
    "list_appointments",
    {
      title: "List Appointments",
      description: "List appointments with optional filters by patient, doctor, status, or date.",
      inputSchema: {
        patientId: z.string().optional().describe("Filter by patient ID"),
        doctorId: z.string().optional().describe("Filter by doctor ID"),
        status: z.enum(["scheduled", "cancelled", "completed"]).optional().describe("Filter by status"),
        date: z.string().optional().describe("Filter by date (YYYY-MM-DD)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ patientId, doctorId, status, date }) => {
      const appointments = await client.getAppointments({ patientId, doctorId, status, date });

      if (appointments.length === 0) {
        return { content: [{ type: "text", text: "No appointments found matching the criteria." }] };
      }

      const lines = await Promise.all(
        appointments.map(async (a) => {
          const dt = new Date(a.dateTime);
          const dateStr = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const timeStr = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
          return `- **${a.id}** | ${dateStr} ${timeStr} | Status: ${a.status} | Reason: ${a.reason}`;
        })
      );

      return {
        content: [{ type: "text", text: `Found ${appointments.length} appointment(s):\n\n${lines.join("\n")}` }],
      };
    }
  );

  // ── 6. recommend_specialist (uses Sampling) ──
  server.registerTool(
    "recommend_specialist",
    {
      title: "Recommend Specialist",
      description:
        "Analyze symptoms and recommend an appropriate medical specialist. Uses AI to match symptoms to specialties, then returns matching doctors.",
      inputSchema: {
        symptoms: z.string().describe("Description of the patient's symptoms"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ symptoms }) => {
      const specialties = await client.getSpecialties();
      const specialtyList = specialties.map((s) => `- ${s.name}: ${s.description}`).join("\n");

      let recommendedSpecialty: string | undefined;

      // Try to use sampling to get an LLM recommendation
      try {
        const samplingResult = await lowLevelServer.createMessage({
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Given these medical specialties:\n\n${specialtyList}\n\nA patient reports the following symptoms: "${symptoms}"\n\nWhich ONE specialty is most appropriate? Reply with ONLY the specialty name, nothing else.`,
              },
            },
          ],
          maxTokens: 50,
        });

        if (samplingResult.content.type === "text") {
          const suggested = samplingResult.content.text.trim();
          const match = specialties.find(
            (s) => s.name.toLowerCase() === suggested.toLowerCase()
          );
          if (match) recommendedSpecialty = match.id;
        }
      } catch {
        // Sampling not supported — use keyword-based fallback
      }

      // Keyword-based fallback
      if (!recommendedSpecialty) {
        const sympLower = symptoms.toLowerCase();
        const keywordMap: Record<string, string[]> = {
          "spec-2": ["chest pain", "heart", "palpitation", "blood pressure", "cardiac", "cardiovascular"],
          "spec-3": ["skin", "rash", "acne", "eczema", "mole", "dermatit"],
          "spec-4": ["bone", "joint", "fracture", "back pain", "knee", "shoulder", "spine", "muscle"],
          "spec-5": ["child", "infant", "baby", "pediatric", "toddler"],
          "spec-6": ["headache", "migraine", "seizure", "numbness", "tingling", "dizzy", "nerve", "brain"],
          "spec-7": ["eye", "vision", "blurry", "blind", "cataract", "glaucoma"],
          "spec-8": ["anxiety", "depression", "stress", "insomnia", "panic", "mood", "mental"],
        };

        for (const [specId, keywords] of Object.entries(keywordMap)) {
          if (keywords.some((kw) => sympLower.includes(kw))) {
            recommendedSpecialty = specId;
            break;
          }
        }
        // Default to General Practice
        if (!recommendedSpecialty) recommendedSpecialty = "spec-1";
      }

      const specialty = specialties.find((s) => s.id === recommendedSpecialty);
      const doctors = await client.getDoctors({ specialtyId: recommendedSpecialty });

      const doctorLines = doctors
        .map((d) => `  - **${d.name}** (ID: ${d.id}) — ${d.bio}\n    Available: ${d.availableDays.join(", ")}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Based on the symptoms "${symptoms}", I recommend seeing a **${specialty?.name}** specialist.\n\n> ${specialty?.description}\n\nAvailable doctors in this specialty:\n\n${doctorLines}\n\nUse the \`get_available_slots\` tool with a doctor ID and date to find available appointment times.`,
          },
        ],
      };
    }
  );
}
