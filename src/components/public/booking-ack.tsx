"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircleIcon } from "lucide-react";
import type { TestDriveCreated } from "@/types/contracts";

/**
 * Shows the (mock) WhatsApp acknowledgement and the assigned consultant. They come from the
 * booking response kept in this tab's sessionStorage — the server page never exposes them by
 * reference alone, because the message contains the buyer's name.
 */
export function BookingAck({ reference }: { reference: string }) {
  const t = useTranslations("testDrive");
  const [data, setData] = useState<TestDriveCreated | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`td:${reference}`);
      if (raw) setData(JSON.parse(raw) as TestDriveCreated);
    } catch {
      /* ignore */
    }
  }, [reference]);

  if (!data) return null;
  return (
    <div className="space-y-4">
      {data.consultantName && (
        <div>
          <p className="text-sm text-muted-foreground">{t("consultant")}</p>
          <p className="font-medium">{data.consultantName}</p>
        </div>
      )}
      <figure className="rounded-2xl bg-[#e7f3e4] p-4 text-[#1d2b1a]">
        <figcaption className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <MessageCircleIcon className="size-4" aria-hidden="true" />
          {t("whatsappTitle")}
        </figcaption>
        <p className="rounded-xl rounded-tl-none bg-white p-3 text-sm whitespace-pre-line shadow-soft">
          {data.acknowledgement.body}
        </p>
        <p className="mt-2 text-xs opacity-70">{t("whatsappMock")}</p>
      </figure>
    </div>
  );
}
