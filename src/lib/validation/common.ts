import { z } from "zod";

export const uuidSchema = z.string().uuid();

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const timezoneSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .refine(isValidTimeZone, {
    message: "Expected a valid IANA timezone identifier.",
  });
