// Shared definition of Executive info sections and which fields are secret.
// Field keys are data in the database; this file is the single source of truth.

type FieldDef = { key: string; label: string; secret?: boolean };

const passportFields: FieldDef[] = [
  { key: "name", label: "name" },
  { key: "number", label: "number", secret: true },
  { key: "country", label: "country" },
  { key: "issued", label: "issued" },
  { key: "expires", label: "expires" },
  { key: "scan_note", label: "scan note" },
];
const visaFields: FieldDef[] = [
  { key: "on_passport", label: "on passport" },
  { key: "number", label: "number", secret: true },
  { key: "type_country", label: "type / country" },
  { key: "issued", label: "issued" },
  { key: "expires", label: "expires" },
];

export const EXEC_SECTIONS: Record<string, { label: string; fields: FieldDef[] }> = {
  personal: {
    label: "Personal",
    fields: [
      { key: "full_name", label: "full name" },
      { key: "full_name_other", label: "full name (other)" },
      { key: "dob", label: "date of birth" },
      { key: "mobile", label: "mobile" },
      { key: "personal_email", label: "personal email" },
      { key: "home_address", label: "home address" },
      { key: "national_id", label: "national ID", secret: true },
      { key: "health_member", label: "health member number", secret: true },
      { key: "blood_type", label: "blood type" },
      { key: "allergies", label: "allergies" },
      { key: "sizes", label: "sizes" },
      { key: "license", label: "license", secret: true },
      { key: "car_insurance", label: "car insurance", secret: true },
      { key: "wedding_anniversary", label: "wedding anniversary" },
    ],
  },
  spouse: {
    label: "Spouse",
    fields: [
      { key: "name", label: "name" },
      { key: "dob", label: "date of birth" },
      { key: "mobile", label: "mobile" },
      { key: "email", label: "email" },
      { key: "national_id", label: "national ID", secret: true },
    ],
  },
  emergency: {
    label: "Emergency contact",
    fields: [
      { key: "name_relationship", label: "name / relationship" },
      { key: "phone", label: "phone" },
    ],
  },
  passport1: { label: "Passport #1", fields: passportFields },
  passport2: { label: "Passport #2", fields: passportFields },
  visa1: { label: "Visa #1", fields: visaFields },
  visa2: { label: "Visa #2", fields: visaFields },
  travel: {
    label: "Travel",
    fields: [
      { key: "global_entry", label: "Global Entry", secret: true },
      { key: "tsa_precheck", label: "TSA PreCheck", secret: true },
      { key: "seat", label: "seat" },
      { key: "meal", label: "meal" },
      { key: "airport", label: "airport" },
      { key: "rental_loyalty", label: "rental loyalty", secret: true },
      { key: "notes", label: "notes" },
    ],
  },
  company: {
    label: "Company",
    fields: [
      { key: "name", label: "name" },
      { key: "registration", label: "registration", secret: true },
      { key: "address", label: "address" },
      { key: "tax_id", label: "tax ID", secret: true },
      { key: "bank_login_item", label: "bank login item" },
    ],
  },
  secondary_company: {
    label: "Secondary company",
    fields: [
      { key: "name", label: "name" },
      { key: "registration", label: "registration", secret: true },
      { key: "state", label: "state" },
      { key: "agent", label: "agent" },
    ],
  },
};

export const EXEC_ROW_KINDS = ["child", "date", "airline", "hotel", "other", "pro"] as const;
export type ExecRowKind = (typeof EXEC_ROW_KINDS)[number];

export const EXEC_ROW_DEFS: Record<
  ExecRowKind,
  { label: string; columns: string[]; hasSecret: boolean; secretLabel?: string }
> = {
  child: { label: "Child", columns: ["name", "dob", "school_notes"], hasSecret: false },
  date: { label: "Important date", columns: ["occasion", "date", "relationship", "notes"], hasSecret: false },
  airline: { label: "Airline", columns: ["program", "login_item"], hasSecret: true, secretLabel: "member number" },
  hotel: { label: "Hotel", columns: ["program", "login_item"], hasSecret: true, secretLabel: "member number" },
  other: { label: "Loyalty", columns: ["program", "login_item"], hasSecret: true, secretLabel: "member number" },
  pro: { label: "Professional", columns: ["role", "name_firm", "phone", "email"], hasSecret: false },
};

export function findField(section: string, key: string): FieldDef | undefined {
  return EXEC_SECTIONS[section]?.fields.find((f) => f.key === key);
}

export function isSecretField(section: string, key: string): boolean {
  return findField(section, key)?.secret === true;
}

export function fieldLabel(section: string, key: string): string {
  const s = EXEC_SECTIONS[section];
  const f = findField(section, key);
  return `${s?.label ?? "Field"} ${f?.label ?? key}`;
}
