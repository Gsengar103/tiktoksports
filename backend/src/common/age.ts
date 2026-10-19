import { AgeBand } from "@prisma/client";

export function ageYears(dateOfBirth: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function ageBandFromDob(dateOfBirth: Date, now = new Date()): AgeBand | null {
  const age = ageYears(dateOfBirth, now);
  if (age < 13) return null;
  if (age <= 15) return AgeBand.AGE_13_15;
  if (age <= 17) return AgeBand.AGE_16_17;
  return AgeBand.AGE_18_PLUS;
}
