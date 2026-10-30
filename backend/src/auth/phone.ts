import { BadRequestException } from "@nestjs/common";

export function normalizePhone(input: string): string {
  const compact = input.trim().replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) {
    return e164(compact.slice(1));
  }
  if (/^\d{10}$/.test(compact)) {
    return e164(`91${compact}`);
  }
  if (/^91\d{10}$/.test(compact)) {
    return e164(compact);
  }
  throw new BadRequestException("Enter a valid phone number");
}

function e164(digits: string): string {
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    throw new BadRequestException("Enter a valid phone number");
  }
  return `+${digits}`;
}
