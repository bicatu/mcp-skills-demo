import { Hono } from "hono";
import { store } from "../store.js";

const doctors = new Hono();

doctors.get("/", (c) => {
  const specialtyId = c.req.query("specialtyId");
  const name = c.req.query("name");
  return c.json(store.getDoctors({ specialtyId, name }));
});

doctors.get("/:id", (c) => {
  const doctor = store.getDoctor(c.req.param("id"));
  if (!doctor) return c.json({ error: "Doctor not found" }, 404);
  return c.json(doctor);
});

doctors.get("/:id/slots", (c) => {
  const date = c.req.query("date");
  if (!date) return c.json({ error: "Query parameter 'date' is required (YYYY-MM-DD)" }, 400);
  const result = store.getAvailableSlots(c.req.param("id"), date);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

export { doctors };
