import {
  PatientCondition,
  PatientEquipment,
  PatientGoal,
  PatientSnapshot,
  PatientEmergencyCare,
  PatientAllergy,
  PatientMedication,
  tables,
  Hospitalization,
  SurgeryProcedure,
  DischargeInstruction,
  Patient,
  User,
  PatientNote,
  Contact,
} from "@/services/database/migrations/v1/schema_v1";

// Sample dates for consistent timestamps
const now = new Date();
const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);
const lastWeek = new Date(now);
lastWeek.setDate(lastWeek.getDate() - 7);
const nextMonth = new Date(now);
nextMonth.setMonth(nextMonth.getMonth() + 1);

export const samplePatientSnapshots: Partial<PatientSnapshot>[] = [
  {
    patient_id: 1,
    patient_overview: "Patient is doing well with current treatment plan",
    health_issues: "Mild asthma, seasonal allergies",
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
];

export const samplePatientConditions: Partial<PatientCondition>[] = [
  {
    patient_id: 1,
    condition_name: "Asthma",
    onset_date: new Date(lastWeek),
    created_date: new Date(lastWeek),
    updated_date: new Date(lastWeek),
    linked_health_system: true,
  },
  {
    patient_id: 1,
    condition_name: "Seasonal Allergies",
    onset_date: new Date(yesterday),
    created_date: new Date(yesterday),
    updated_date: new Date(yesterday),
    linked_health_system: false,
  },
  {
    patient_id: 1,
    condition_name: "High Blood Pressure",
    onset_date: new Date(now),
    created_date: new Date(now),
    updated_date: new Date(now),
    linked_health_system: true,
  },
];

export const samplePatientEquipment: Partial<PatientEquipment>[] = [
  {
    patient_id: 1,
    equipment_name: "Inhaler",
    equipment_description: "Albuterol inhaler for asthma",
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
    linked_health_system: true,
  },
  {
    patient_id: 1,
    equipment_name: "Peak Flow Meter",
    equipment_description: "For monitoring asthma symptoms",
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
    linked_health_system: true,
  },
  {
    patient_id: 1,
    equipment_name: "Blood Pressure Monitor",
    equipment_description: "Home blood pressure monitoring device",
    created_date: new Date(yesterday),
    updated_date: new Date(now),
    linked_health_system: false,
  },
  {
    patient_id: 1,
    equipment_name: "Nebulizer",
    equipment_description: "For severe asthma symptoms",
    created_date: new Date(now),
    updated_date: new Date(now),
    linked_health_system: true,
  },
];

export const samplePatientGoals: Partial<PatientGoal>[] = [
  {
    patient_id: 1,
    goal_description: "Improve asthma control",
    target_date: new Date(nextMonth),
    linked_health_system: true,
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
  {
    patient_id: 1,
    goal_description: "Regular blood pressure monitoring",
    target_date: new Date(nextMonth),
    linked_health_system: true,
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
  {
    patient_id: 1,
    goal_description: "Maintain healthy diet",
    target_date: new Date(nextMonth),
    linked_health_system: false,
    created_date: new Date(yesterday),
    updated_date: new Date(now),
  },
];

export const samplePatientEmergencyCare: Partial<PatientEmergencyCare>[] = [
  {
    patient_id: 1,
    topic: "Emergency Contact Information",
    details:
      "Primary: John Doe (Spouse) - +1234567890\nSecondary: Jane Smith (Sister) - +0987654321",
    linked_health_system: true,
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
  {
    patient_id: 1,
    topic: "Preferred Hospital",
    details: "City General Hospital - 123 Medical Center Drive",
    linked_health_system: true,
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
  {
    patient_id: 1,
    topic: "Emergency Protocol",
    details:
      "1. Use inhaler immediately for severe asthma\n2. Call emergency contact\n3. Go to nearest ER if symptoms persist",
    linked_health_system: false,
    created_date: new Date(yesterday),
    updated_date: new Date(now),
  },
];

export const samplePatientAllergies: Partial<PatientAllergy>[] = [
  {
    patient_id: 1,
    topic: "Penicillin",
    details: "Severe allergic reaction - hives and difficulty breathing",
    severity: "Severe",
    onset_date: new Date(lastWeek),
    linked_health_system: true,
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
  {
    patient_id: 1,
    topic: "Pollen",
    details: "Seasonal allergies - sneezing and congestion",
    severity: "Moderate",
    onset_date: new Date(lastWeek),
    linked_health_system: false,
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
  {
    patient_id: 1,
    topic: "Shellfish",
    details: "Mild rash and itching",
    severity: "Mild",
    onset_date: new Date(yesterday),
    linked_health_system: true,
    created_date: new Date(yesterday),
    updated_date: new Date(now),
  },
];

export const samplePatientMedications: Partial<PatientMedication>[] = [
  {
    patient_id: 1,
    name: "Albuterol Inhaler",
    details: "2 puffs as needed for asthma symptoms\nPrescribed by Dr. Smith",
    linked_health_system: true,
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
  {
    patient_id: 1,
    name: "Lisinopril",
    details: "10mg daily for blood pressure\nTake in the morning",
    linked_health_system: true,
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
  {
    patient_id: 1,
    name: "Cetirizine",
    details: "10mg daily for allergies\nTake as needed during allergy season",
    linked_health_system: false,
    created_date: new Date(yesterday),
    updated_date: new Date(now),
  },
];

export const samplePatientNotes: Partial<PatientNote>[] = [
  {
    patient_id: 1,
    topic: "Follow-up Appointment",
    details: "Schedule follow-up with Dr. Smith for blood pressure check",
    reminder_date: new Date("2024-03-15T10:00:00"),
    created_date: new Date("2024-02-15T09:30:00"),
    updated_date: new Date("2024-02-15T09:30:00"),
  },
  {
    patient_id: 1,
    topic: "Medication Refill",
    details: "Need to refill blood pressure medication next week",
    reminder_date: new Date("2024-03-10T14:00:00"),
    created_date: new Date("2024-02-14T15:45:00"),
    updated_date: new Date("2024-02-14T15:45:00"),
  },
  {
    patient_id: 1,
    topic: "Lab Results Review",
    details: "Review latest blood work results with healthcare provider",
    reminder_date: new Date("2024-03-20T11:30:00"),
    created_date: new Date("2024-02-16T13:20:00"),
    updated_date: new Date("2024-02-16T13:20:00"),
  },
];

export const sampleHospitalizations: Partial<Hospitalization>[] = [
  {
    patient_id: 1,
    linked_health_system: true,
    admission_date: new Date("2023-12-01"),
    discharge_date: new Date("2023-12-10"),
    details: "Asthma exacerbation, required nebulizer therapy.",
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
  {
    patient_id: 1,
    linked_health_system: false,
    admission_date: new Date("2022-06-15"),
    discharge_date: new Date("2022-06-20"),
    details: "Appendectomy, no complications.",
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
];

export const sampleSurgeryProcedures: Partial<SurgeryProcedure>[] = [
  {
    patient_id: 1,
    linked_health_system: true,
    procedure_name: "Knee Arthroscopy",
    facility: "City General Hospital",
    complications: "None",
    surgeon_name: "Dr. Alice Brown",
    procedure_date: new Date("2021-03-10"),
    details: "Minimally invasive procedure for meniscus repair.",
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
  {
    patient_id: 1,
    linked_health_system: false,
    procedure_name: "Appendectomy",
    facility: "County Hospital",
    complications: "Mild infection, resolved with antibiotics.",
    surgeon_name: "Dr. Bob Green",
    procedure_date: new Date("2022-06-16"),
    details: "Laparoscopic appendectomy.",
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
];

export const sampleDischargeInstructions: Partial<DischargeInstruction>[] = [
  {
    patient_id: 1,
    linked_health_system: true,
    summary: "Asthma management at home",
    discharge_date: new Date("2023-12-10"),
    details: "Continue inhaler as prescribed. Follow up in 2 weeks.",
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
  {
    patient_id: 1,
    linked_health_system: false,
    summary: "Post-appendectomy care",
    discharge_date: new Date("2022-06-20"),
    details: "Monitor incision site. Return if fever or pain worsens.",
    created_date: new Date(lastWeek),
    updated_date: new Date(now),
  },
];

export const sampleContacts: Partial<Contact>[] = [
  {
    patient_id: 1,
    first_name: 'Sal',
    last_name: 'Petrillo',
    relationship: 'Behavioral Health Nurse Practitioner',
    phone_number: '+91 1111111111',
    description: 'Primary care provider',
    email: 'sal.petrillo@healthcare.com',
    created_date: new Date(lastWeek),
    updated_date: new Date(now)
  },
  {
    patient_id: 1,
    first_name: 'Rue',
    last_name: 'McClanahan',
    relationship: 'Grandmother',
    phone_number: '+91 2222222222',
    description: 'Family member',
    email: 'rue.mcclanahan@email.com',
    created_date: new Date(lastWeek),
    updated_date: new Date(now)
  },
  {
    patient_id: 1,
    first_name: 'Rose',
    last_name: 'Nylund',
    relationship: 'Urologist',
    phone_number: '+91 3333333333',
    description: 'Specialist',
    email: 'rose.nylund@healthcare.com',
    created_date: new Date(yesterday),
    updated_date: new Date(now)
  },
  {
    patient_id: 1,
    first_name: 'Estelle',
    last_name: 'Getty',
    relationship: 'Gastroenterologist',
    phone_number: '+91 4444444444',
    description: 'Specialist',
    email: 'estelle.getty@healthcare.com',
    created_date: new Date(yesterday),
    updated_date: new Date(now)
  },
  {
    patient_id: 1,
    first_name: 'Miles',
    last_name: 'Webber',
    relationship: 'Nero Surgen',
    phone_number: '+91 5555555555',
    description: 'Surgeon',
    email: 'miles.webber@healthcare.com',
    created_date: new Date(now),
    updated_date: new Date(now)
  }
];
