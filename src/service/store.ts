import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Specialty,
  Doctor,
  Patient,
  Appointment,
  AppointmentStatus,
  TimeSlot,
  DayOfWeek,
} from "../types.js";

const DAY_NAMES: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export class AppointmentStore {
  private specialties = new Map<string, Specialty>();
  private doctors = new Map<string, Doctor>();
  private patients = new Map<string, Patient>();
  private appointments = new Map<string, Appointment>();
  private nextAppointmentNum = 1;
  private nextPatientNum = 6; // after seed data

  async bootstrap(dataDir: string): Promise<void> {
    const [specData, docData, patData] = await Promise.all([
      readFile(join(dataDir, "specialties.json"), "utf-8"),
      readFile(join(dataDir, "doctors.json"), "utf-8"),
      readFile(join(dataDir, "patients.json"), "utf-8"),
    ]);

    for (const s of JSON.parse(specData) as Specialty[]) {
      this.specialties.set(s.id, s);
    }
    for (const d of JSON.parse(docData) as Doctor[]) {
      this.doctors.set(d.id, d);
    }
    for (const p of JSON.parse(patData) as Patient[]) {
      this.patients.set(p.id, p);
    }
  }

  // ── Specialties ──

  getSpecialties(): Specialty[] {
    return [...this.specialties.values()];
  }

  getSpecialty(id: string): Specialty | undefined {
    return this.specialties.get(id);
  }

  // ── Doctors ──

  getDoctors(filters?: {
    specialtyId?: string;
    name?: string;
  }): Doctor[] {
    let result = [...this.doctors.values()];
    if (filters?.specialtyId) {
      result = result.filter((d) => d.specialtyId === filters.specialtyId);
    }
    if (filters?.name) {
      const q = filters.name.toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(q));
    }
    return result;
  }

  getDoctor(id: string): Doctor | undefined {
    return this.doctors.get(id);
  }

  // ── Patients ──

  getPatients(): Patient[] {
    return [...this.patients.values()];
  }

  getPatient(id: string): Patient | undefined {
    return this.patients.get(id);
  }

  createPatient(data: Omit<Patient, "id">): Patient {
    const patient: Patient = { ...data, id: `pat-${this.nextPatientNum++}` };
    this.patients.set(patient.id, patient);
    return patient;
  }

  // ── Appointments ──

  getAppointments(filters?: {
    patientId?: string;
    doctorId?: string;
    status?: AppointmentStatus;
    date?: string; // YYYY-MM-DD
  }): Appointment[] {
    let result = [...this.appointments.values()];
    if (filters?.patientId) {
      result = result.filter((a) => a.patientId === filters.patientId);
    }
    if (filters?.doctorId) {
      result = result.filter((a) => a.doctorId === filters.doctorId);
    }
    if (filters?.status) {
      result = result.filter((a) => a.status === filters.status);
    }
    if (filters?.date) {
      result = result.filter((a) => a.dateTime.startsWith(filters.date!));
    }
    return result;
  }

  getAppointment(id: string): Appointment | undefined {
    return this.appointments.get(id);
  }

  bookAppointment(data: {
    patientId: string;
    doctorId: string;
    dateTime: string;
    reason: string;
    notes?: string;
  }): Appointment | { error: string } {
    const doctor = this.doctors.get(data.doctorId);
    if (!doctor) return { error: "Doctor not found" };

    const patient = this.patients.get(data.patientId);
    if (!patient) return { error: "Patient not found" };

    // Check the requested time falls within working hours and available days
    const dt = new Date(data.dateTime);
    const dayName = DAY_NAMES[dt.getDay()];
    if (!doctor.availableDays.includes(dayName)) {
      return { error: `Doctor is not available on ${dayName}` };
    }

    const timeStr = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
    if (timeStr < doctor.workingHours.start || timeStr >= doctor.workingHours.end) {
      return { error: "Requested time is outside doctor's working hours" };
    }

    // Check for conflicting appointments
    const endTime = new Date(dt.getTime() + doctor.slotDurationMinutes * 60000);
    const conflict = [...this.appointments.values()].find((a) => {
      if (a.doctorId !== data.doctorId || a.status === "cancelled") return false;
      const aStart = new Date(a.dateTime).getTime();
      const aEnd = aStart + a.durationMinutes * 60000;
      return dt.getTime() < aEnd && endTime.getTime() > aStart;
    });
    if (conflict) {
      return { error: "Time slot is already booked" };
    }

    const appointment: Appointment = {
      id: `apt-${this.nextAppointmentNum++}`,
      patientId: data.patientId,
      doctorId: data.doctorId,
      dateTime: data.dateTime,
      durationMinutes: doctor.slotDurationMinutes,
      status: "scheduled",
      reason: data.reason,
      notes: data.notes,
    };
    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  cancelAppointment(id: string): Appointment | { error: string } {
    const apt = this.appointments.get(id);
    if (!apt) return { error: "Appointment not found" };
    if (apt.status === "cancelled") return { error: "Appointment is already cancelled" };
    if (apt.status === "completed") return { error: "Cannot cancel a completed appointment" };
    apt.status = "cancelled";
    return apt;
  }

  completeAppointment(
    id: string,
    notes?: string
  ): Appointment | { error: string } {
    const apt = this.appointments.get(id);
    if (!apt) return { error: "Appointment not found" };
    if (apt.status === "cancelled") return { error: "Cannot complete a cancelled appointment" };
    if (apt.status === "completed") return { error: "Appointment is already completed" };
    apt.status = "completed";
    if (notes) apt.notes = notes;
    return apt;
  }

  // ── Time Slots ──

  getAvailableSlots(doctorId: string, date: string): TimeSlot[] | { error: string } {
    const doctor = this.doctors.get(doctorId);
    if (!doctor) return { error: "Doctor not found" };

    const dateObj = new Date(date + "T00:00:00");
    const dayName = DAY_NAMES[dateObj.getDay()];
    if (!doctor.availableDays.includes(dayName)) {
      return []; // Doctor doesn't work this day
    }

    const [startH, startM] = doctor.workingHours.start.split(":").map(Number);
    const [endH, endM] = doctor.workingHours.end.split(":").map(Number);
    const slotMs = doctor.slotDurationMinutes * 60000;

    const dayStart = new Date(dateObj);
    dayStart.setHours(startH, startM, 0, 0);
    const dayEnd = new Date(dateObj);
    dayEnd.setHours(endH, endM, 0, 0);

    // Existing appointments for this doctor on this date
    const booked = [...this.appointments.values()].filter(
      (a) =>
        a.doctorId === doctorId &&
        a.status !== "cancelled" &&
        a.dateTime.startsWith(date)
    );

    const slots: TimeSlot[] = [];
    let current = dayStart.getTime();
    while (current + slotMs <= dayEnd.getTime()) {
      const slotStart = current;
      const slotEnd = current + slotMs;

      const isBooked = booked.some((a) => {
        const aStart = new Date(a.dateTime).getTime();
        const aEnd = aStart + a.durationMinutes * 60000;
        return slotStart < aEnd && slotEnd > aStart;
      });

      slots.push({
        startTime: new Date(slotStart).toISOString(),
        endTime: new Date(slotEnd).toISOString(),
        available: !isBooked,
      });

      current += slotMs;
    }

    return slots;
  }
}

// Singleton for use by routes
export const store = new AppointmentStore();
