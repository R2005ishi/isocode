"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CITY_COOKIE, LOCALE_COOKIE, isLocale } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Language toggle (EN / हिं). Only "en" and "hi" are accepted. */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

/** City selector for on-road prices. Slug format only; unknown cities fall back on read. */
export async function setCity(citySlug: string) {
  if (!/^[a-z0-9-]{1,40}$/.test(citySlug)) return;
  const store = await cookies();
  store.set(CITY_COOKIE, citySlug, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

/** Form-action variant used by the header toggle (works without JavaScript). */
export async function setLocaleFromForm(fd: FormData) {
  await setLocale(String(fd.get("locale") ?? "en"));
}
