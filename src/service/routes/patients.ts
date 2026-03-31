import { Hono } from "hono";
import { store } from "../store.js";

const patients = new Hono();

patients.get("/", (c) => {
  return c.json(store.getPatients());
});

patients.get("/:id", (c) => {
  const patient = store.getPatient(c.req.param("id"));
  if (!patient) return c.json({ error: "Patient not found" }, 404);
  return c.json(patient);
});

patients.post("/", async (c) => {
  const body = await c.req.json();
  const { name, email, phone, dateOfBirth } = body;
  if (!name || !email || !phone || !dateOfBirth) {
    return c.json({ error: "name, email, phone, and dateOfBirth are required" }, 400);
  }
  const patient = store.createPatient({ name, email, phone, dateOfBirth });
  return c.json(patient, 201);
});

export { patients };
