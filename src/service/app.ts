import { Hono } from "hono";
import { logger } from "hono/logger";
import { specialties } from "./routes/specialties.js";
import { doctors } from "./routes/doctors.js";
import { patients } from "./routes/patients.js";
import { appointments } from "./routes/appointments.js";

const app = new Hono();

app.use("*", logger());

app.get("/", (c) => c.json({ name: "Medical Appointment Service", version: "1.0.0" }));

app.route("/api/specialties", specialties);
app.route("/api/doctors", doctors);
app.route("/api/patients", patients);
app.route("/api/appointments", appointments);

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

export { app };
