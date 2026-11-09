"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LeadDetail } from "@/types/contracts";
import { api, errorMessage } from "../api";

export const leadKey = (id: string) => ["lead", id] as const;

export function useLead(id: string) {
  return useQuery({
    queryKey: leadKey(id),
    queryFn: () => api<LeadDetail>(`/api/leads/${id}`),
    // Keep the timeline fresh if a colleague acts on the same lead.
    refetchInterval: 30_000,
  });
}

/**
 * Mutation that returns the updated LeadDetail: writes it into the cache, refreshes the
 * inbox list, and toasts the API's own error message on failure.
 */
export function useLeadMutation<V>(
  id: string,
  fn: (vars: V) => Promise<LeadDetail>,
  opts: { success?: string | ((lead: LeadDetail, vars: V) => string); onSuccess?: (lead: LeadDetail, vars: V) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (lead, vars) => {
      qc.setQueryData(leadKey(id), lead);
      qc.invalidateQueries({ queryKey: ["leads"] });
      const msg = typeof opts.success === "function" ? opts.success(lead, vars) : opts.success;
      if (msg) toast.success(msg);
      opts.onSuccess?.(lead, vars);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
