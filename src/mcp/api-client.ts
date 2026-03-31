import type {
  Specialty,
  Doctor,
  Patient,
  Appointment,
  AppointmentStatus,
  TimeSlot,
} from "../types.js";

export class ServiceClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? process.env.SERVICE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return data as T;
  }

  // ── Specialties ──

  async getSpecialties(): Promise<Specialty[]> {
    return this.request("/api/specialties");
  }

  async getSpecialty(id: string): Promise<Specialty> {
    return this.request(`/api/specialties/${encodeURIComponent(id)}`);
  }

  // ── Doctors ──

  async getDoctors(filters?: { specialtyId?: string; name?: string }): Promise<Doctor[]> {
    const params = new URLSearchParams();
    if (filters?.specialtyId) params.set("specialtyId", filters.specialtyId);
    if (filters?.name) params.set("name", filters.name);
    const qs = params.toString();
    return this.request(`/api/doctors${qs ? `?${qs}` : ""}`);
  }

  async getDoctor(id: string): Promise<Doctor> {
    return this.request(`/api/doctors/${encodeURIComponent(id)}`);
  }

  async getAvailableSlots(doctorId: string, date: string): Promise<TimeSlot[]> {
    return this.request(
      `/api/doctors/${encodeURIComponent(doctorId)}/slots?date=${encodeURIComponent(date)}`
    );
  }

  // ── Patients ──

  async getPatients(): Promise<Patient[]> {
    return this.request("/api/patients");
  }

  async getPatient(id: string): Promise<Patient> {
    return this.request(`/api/patients/${encodeURIComponent(id)}`);
  }

  async createPatient(data: Omit<Patient, "id">): Promise<Patient> {
    return this.request("/api/patients", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ── Appointments ──

  async getAppointments(filters?: {
    patientId?: string;
    doctorId?: string;
    status?: AppointmentStatus;
    date?: string;
  }): Promise<Appointment[]> {
    const params = new URLSearchParams();
    if (filters?.patientId) params.set("patientId", filters.patientId);
    if (filters?.doctorId) params.set("doctorId", filters.doctorId);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.date) params.set("date", filters.date);
    const qs = params.toString();
    return this.request(`/api/appointments${qs ? `?${qs}` : ""}`);
  }

  async getAppointment(id: string): Promise<Appointment> {
    return this.request(`/api/appointments/${encodeURIComponent(id)}`);
  }

  async bookAppointment(data: {
    patientId: string;
    doctorId: string;
    dateTime: string;
    reason: string;
    notes?: string;
  }): Promise<Appointment> {
    return this.request("/api/appointments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async cancelAppointment(id: string): Promise<Appointment> {
    return this.request(`/api/appointments/${encodeURIComponent(id)}/cancel`, {
      method: "PATCH",
    });
  }

  async completeAppointment(id: string, notes?: string): Promise<Appointment> {
    return this.request(`/api/appointments/${encodeURIComponent(id)}/complete`, {
      method: "PATCH",
      body: JSON.stringify({ notes }),
    });
  }
}
