import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { assignLead, pickConsultant, type AssignmentCandidate } from "./assignment";

const c = (
  id: string,
  showroomId: string | null,
  openLeads: number,
  lastAssignedAt: string | null = null,
): AssignmentCandidate => ({
  id,
  showroomId,
  openLeads,
  lastAssignedAt: lastAssignedAt ? new Date(lastAssignedAt) : null,
});

describe("pickConsultant", () => {
  it("returns null with no candidates", () => {
    expect(pickConsultant([], "s1")).toBeNull();
  });

  it("prefers the same showroom even if others have fewer open leads", () => {
    expect(pickConsultant([c("a", "s2", 0), c("b", "s1", 5)], "s1")).toBe("b");
  });

  it("picks fewest open leads", () => {
    expect(pickConsultant([c("a", "s1", 3), c("b", "s1", 1), c("c", "s1", 2)], "s1")).toBe("b");
  });

  it("ties → oldest lastAssignedAt, null counts as oldest", () => {
    const list = [c("a", "s1", 1, "2026-11-07T10:00:00Z"), c("b", "s1", 1, "2026-11-06T10:00:00Z")];
    expect(pickConsultant(list, "s1")).toBe("b");
    expect(pickConsultant([...list, c("z", "s1", 1, null)], "s1")).toBe("z");
  });

  it("final tie → id ascending", () => {
    expect(pickConsultant([c("m", "s1", 0), c("k", "s1", 0)], "s1")).toBe("k");
    const t = "2026-11-07T10:00:00Z";
    expect(pickConsultant([c("m", "s1", 0, t), c("k", "s1", 0, t)], "s1")).toBe("k");
  });

  it("falls back to any showroom when none local", () => {
    expect(pickConsultant([c("a", "s2", 2), c("b", "s3", 1)], "s1")).toBe("b");
  });

  it("uses all candidates when lead has no showroom", () => {
    expect(pickConsultant([c("a", "s2", 2), c("b", null, 0)], null)).toBe("b");
  });

  it("without a model id, specialties are ignored", () => {
    const list = [{ ...c("a", "s1", 3), specialtyModelIds: ["m1"] }, c("b", "s1", 1)];
    expect(pickConsultant(list, "s1")).toBe("b");
    expect(pickConsultant(list, "s1", null)).toBe("b");
  });

  it("prefers a same-showroom specialist over a less-loaded local generalist", () => {
    const list = [
      { ...c("a", "s1", 4), specialtyModelIds: ["m1"] },
      c("b", "s1", 0),
      { ...c("x", "s2", 0), specialtyModelIds: ["m1"] },
    ];
    expect(pickConsultant(list, "s1", "m1")).toBe("a");
  });

  it("same showroom beats an off-showroom specialist", () => {
    const list = [c("b", "s1", 5), { ...c("x", "s2", 0), specialtyModelIds: ["m1"] }];
    expect(pickConsultant(list, "s1", "m1")).toBe("b");
  });

  it("falls back to any specialist when the showroom has nobody", () => {
    const list = [
      c("g", "s2", 0),
      { ...c("x", "s3", 2), specialtyModelIds: ["m1"] },
      { ...c("y", "s2", 1), specialtyModelIds: ["m1", "m2"] },
    ];
    expect(pickConsultant(list, "s9", "m1")).toBe("y");
    expect(pickConsultant(list, null, "m1")).toBe("y");
  });

  it("falls back to anyone when nobody specialises in the model", () => {
    const list = [c("g", "s2", 1), { ...c("x", "s3", 0), specialtyModelIds: ["m2"] }];
    expect(pickConsultant(list, "s9", "m1")).toBe("x");
  });

  it("keeps the load tie-breaks inside the specialist pool", () => {
    const t = "2026-11-07T10:00:00Z";
    const list = [
      { ...c("p", "s1", 1, t), specialtyModelIds: ["m1"] },
      { ...c("q", "s1", 1, null), specialtyModelIds: ["m1"] },
      { ...c("r", "s1", 2), specialtyModelIds: ["m1"] },
    ];
    expect(pickConsultant(list, "s1", "m1")).toBe("q");
  });

  it("does not mutate the input", () => {
    const list = [c("b", "s1", 2), c("a", "s1", 1)];
    pickConsultant(list, "s1");
    expect(list.map((x) => x.id)).toEqual(["b", "a"]);
  });
});

function fakeTx(consultants: unknown[], admin: { id: string; name: string } | null) {
  return {
    user: {
      findMany: vi.fn().mockResolvedValue(consultants),
      findFirst: vi.fn().mockResolvedValue(admin),
      update: vi.fn().mockResolvedValue({}),
    },
    lead: { update: vi.fn().mockResolvedValue({}) },
    leadActivity: { create: vi.fn().mockResolvedValue({}) },
  };
}
const asTx = (t: ReturnType<typeof fakeTx>) => t as unknown as Prisma.TransactionClient;

describe("assignLead", () => {
  const consultants = [
    {
      id: "u1",
      name: "Asha",
      showroomId: "s1",
      lastAssignedAt: null,
      _count: { assignedLeads: 3 },
    },
    {
      id: "u2",
      name: "Ravi",
      showroomId: "s1",
      lastAssignedAt: null,
      _count: { assignedLeads: 1 },
    },
  ];

  it("assigns the picked consultant and records the activity", async () => {
    const tx = fakeTx(consultants, null);
    const r = await assignLead(asTx(tx), "lead1", "s1");
    expect(r).toEqual({ id: "u2", name: "Ravi" });
    expect(tx.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: { assignedToId: "u2" },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: { lastAssignedAt: expect.any(Date) },
    });
    expect(tx.leadActivity.create).toHaveBeenCalledWith({
      data: { leadId: "lead1", type: "ASSIGNED", note: "Auto-assigned to Ravi" },
    });
    expect(tx.user.findFirst).not.toHaveBeenCalled();
  });

  it("routes to the model specialist when a model id is given", async () => {
    const tx = fakeTx(
      [
        { ...consultants[0], specialtyModelIds: ["m1"] },
        { ...consultants[1], specialtyModelIds: [] },
      ],
      null,
    );
    expect(await assignLead(asTx(tx), "lead1", "s1", "m1")).toEqual({ id: "u1", name: "Asha" });
    expect(await assignLead(asTx(tx), "lead1", "s1")).toEqual({ id: "u2", name: "Ravi" });
  });

  it("falls back to an admin when there are no consultants", async () => {
    const tx = fakeTx([], { id: "adm", name: "Lead Desk" });
    expect(await assignLead(asTx(tx), "lead1", "s1")).toEqual({ id: "adm", name: "Lead Desk" });
    expect(tx.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: { assignedToId: "adm" },
    });
  });

  it("returns null and writes nothing when nobody can take it", async () => {
    const tx = fakeTx([], null);
    expect(await assignLead(asTx(tx), "lead1", null)).toBeNull();
    expect(tx.lead.update).not.toHaveBeenCalled();
    expect(tx.leadActivity.create).not.toHaveBeenCalled();
  });
});
