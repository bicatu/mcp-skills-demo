import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceClient } from "./api-client.js";

export function registerResources(server: McpServer, client: ServiceClient) {
  // ── 1. All Specialties (static resource) ──
  server.registerResource(
    "all-specialties",
    "specialties://list",
    {
      title: "Medical Specialties",
      description: "Complete list of available medical specialties",
      mimeType: "application/json",
    },
    async (uri) => {
      const specialties = await client.getSpecialties();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(specialties, null, 2),
          },
        ],
      };
    }
  );

  // ── 2. Doctor Profile (template resource) ──
  server.registerResource(
    "doctor-profile",
    new ResourceTemplate("doctor://{doctorId}/profile", {
      list: async () => {
        const doctors = await client.getDoctors();
        return {
          resources: doctors.map((d) => ({
            uri: `doctor://${d.id}/profile`,
            name: d.name,
          })),
        };
      },
    }),
    {
      title: "Doctor Profile",
      description: "Detailed profile for a specific doctor",
      mimeType: "application/json",
    },
    async (uri, { doctorId }) => {
      const doctor = await client.getDoctor(doctorId as string);
      const specialties = await client.getSpecialties();
      const specialty = specialties.find((s) => s.id === doctor.specialtyId);

      const profile = {
        ...doctor,
        specialtyName: specialty?.name,
        specialtyDescription: specialty?.description,
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(profile, null, 2),
          },
        ],
      };
    }
  );

  // ── 3. Patient Summary (template resource) ──
  server.registerResource(
    "patient-summary",
    new ResourceTemplate("patient://{patientId}/summary", {
      list: async () => {
        const patients = await client.getPatients();
        return {
          resources: patients.map((p) => ({
            uri: `patient://${p.id}/summary`,
            name: p.name,
          })),
        };
      },
    }),
    {
      title: "Patient Summary",
      description: "Patient information and appointment history",
      mimeType: "application/json",
    },
    async (uri, { patientId }) => {
      const patient = await client.getPatient(patientId as string);
      const appointments = await client.getAppointments({ patientId: patientId as string });

      const summary = {
        patient,
        totalAppointments: appointments.length,
        scheduled: appointments.filter((a) => a.status === "scheduled").length,
        completed: appointments.filter((a) => a.status === "completed").length,
        cancelled: appointments.filter((a) => a.status === "cancelled").length,
        appointments,
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    }
  );

  // ── 4. Appointment Detail (template resource) ──
  server.registerResource(
    "appointment-detail",
    new ResourceTemplate("appointment://{appointmentId}", {
      list: async () => {
        const appointments = await client.getAppointments();
        return {
          resources: appointments.map((a) => ({
            uri: `appointment://${a.id}`,
            name: `${a.id} — ${a.reason}`,
          })),
        };
      },
    }),
    {
      title: "Appointment Detail",
      description: "Full details of a specific appointment",
      mimeType: "application/json",
    },
    async (uri, { appointmentId }) => {
      const appointment = await client.getAppointment(appointmentId as string);
      const [patient, doctor] = await Promise.all([
        client.getPatient(appointment.patientId),
        client.getDoctor(appointment.doctorId),
      ]);

      const detail = {
        ...appointment,
        patientName: patient.name,
        doctorName: doctor.name,
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(detail, null, 2),
          },
        ],
      };
    }
  );
}
