import { Hono } from "hono";
import { store } from "../store.js";
import type { AppointmentStatus } from "../../types.js";

const appointments = new Hono();

appointments.get("/", (c) => {
  const patientId = c.req.query("patientId");
  const doctorId = c.req.query("doctorId");
  const status = c.req.query("status") as AppointmentStatus | undefined;
  const date = c.req.query("date");
  return c.json(store.getAppointments({ patientId, doctorId, status, date }));
});

appointments.get("/:id", (c) => {
  const apt = store.getAppointment(c.req.param("id"));
  if (!apt) return c.json({ error: "Appointment not found" }, 404);
  return c.json(apt);
});

appointments.post("/", async (c) => {
  const body = await c.req.json();
  const { patientId, doctorId, dateTime, reason, notes } = body;
  if (!patientId || !doctorId || !dateTime || !reason) {
    return c.json(
      { error: "patientId, doctorId, dateTime, and reason are required" },
      400
    );
  }
  const result = store.bookAppointment({ patientId, doctorId, dateTime, reason, notes });
  if ("error" in result) return c.json(result, 400);
  return c.json(result, 201);
});

appointments.patch("/:id/cancel", (c) => {
  const result = store.cancelAppointment(c.req.param("id"));
  if ("error" in result) return c.json(result, 400);
  return c.json(result);
});

appointments.patch("/:id/complete", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const result = store.completeAppointment(c.req.param("id"), body?.notes);
  if ("error" in result) return c.json(result, 400);
  return c.json(result);
});

export { appointments };
