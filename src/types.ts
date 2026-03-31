export type Specialty = {
  id: string;
  name: string;
  description: string;
};

export type WorkingHours = {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
};

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type Doctor = {
  id: string;
  name: string;
  specialtyId: string;
  bio: string;
  availableDays: DayOfWeek[];
  slotDurationMinutes: number;
  workingHours: WorkingHours;
};

export type Patient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string; // "YYYY-MM-DD"
};

export type AppointmentStatus = "scheduled" | "cancelled" | "completed";

export type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  dateTime: string; // ISO 8601
  durationMinutes: number;
  status: AppointmentStatus;
  reason: string;
  notes?: string;
};

export type TimeSlot = {
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  available: boolean;
};
