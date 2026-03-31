import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { app } from "./app.js";
import { store } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "..", "data");

async function main() {
  await store.bootstrap(dataDir);

  const port = Number(process.env.PORT) || 3000;
  console.log(`Bootstrapped data: ${store.getSpecialties().length} specialties, ${store.getDoctors().length} doctors, ${store.getPatients().length} patients`);
  console.log(`Medical Appointment Service listening on http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
}

main().catch((err) => {
  console.error("Failed to start service:", err);
  process.exit(1);
});
