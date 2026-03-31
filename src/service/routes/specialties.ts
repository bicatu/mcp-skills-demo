import { Hono } from "hono";
import { store } from "../store.js";

const specialties = new Hono();

specialties.get("/", (c) => {
  return c.json(store.getSpecialties());
});

specialties.get("/:id", (c) => {
  const specialty = store.getSpecialty(c.req.param("id"));
  if (!specialty) return c.json({ error: "Specialty not found" }, 404);
  return c.json(specialty);
});

export { specialties };
