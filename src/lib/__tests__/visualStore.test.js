import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, listChips, saveChip,
  createIntake, getIntake, reviewReferenceMedia, supplierTasks, createProcurement,
  addCadVersion, decideCad,
} from "../store.js";

beforeEach(() => resetDB());

describe("visual store — 칩 카탈로그", () => {
  it("시드에 칩 카탈로그가 있고 부위 필터가 동작한다", () => {
    expect(listChips().length).toBeGreaterThanOrEqual(10);
    const bandChips = listChips({ part: "band" });
    expect(bandChips.some((c) => c.key === "thinner")).toBe(true);
    expect(bandChips.some((c) => c.key === "prong6")).toBe(false); // 프롱 전용
  });

  it("saveChip — 비활성화하면 목록에서 빠진다", () => {
    const chip = listChips().find((c) => c.key === "polishMatte");
    saveChip({ ...chip, active: false });
    expect(listChips().some((c) => c.key === "polishMatte")).toBe(false);
  });
});

describe("visual store — 레퍼런스 미디어와 벤더 브리프", () => {
  it("인테이크 레퍼런스는 pending으로 저장, 무효 주석은 드랍", () => {
    const { intake } = createIntake({
      name: "Ref", contact: "r@x.com", productLine: "solitaire", category: "ring", styleId: "RING-001",
      metal: "18kw", conditional: { ringSize: "6" }, termsAccepted: true,
      referenceMedia: [{ kind: "image", src: "/up/a.png", annotations: [
        { pinId: 1, x: 40, y: 40, part: "band", chipKey: "thinner", value: 1.6 },
        { pinId: 2, x: 40, y: 40, part: "band", chipKey: "prong6" }, // 칩-부위 불일치 → 드랍
      ] }],
    });
    const saved = getIntake(intake.id).referenceMedia;
    expect(saved[0].status).toBe("pending");
    expect(saved[0].id).toMatch(/^REF-\d{6}$/);
    expect(saved[0].annotations.length).toBe(1);
  });

  it("벤더 태스크에는 승인된 레퍼런스만 — pending/rejected/고객명 미노출", () => {
    // 시드: IN-000001에 approved 1 + pending 1
    createProcurement("DM-000001", { type: "cad", supplierId: "u-supplier2", dueDate: "2026-06-25", brief: "ring cad" });
    const tasks = supplierTasks("u-supplier2");
    const json = JSON.stringify(tasks);
    expect(json).toContain("lineup-band.png");          // approved
    expect(json).not.toContain("lineup-pendant.png");   // pending
    expect(json).not.toContain("김지원");
    expect(json).not.toContain("DM-000001");
  });

  it("검수 승인/반려가 벤더 노출을 토글한다", () => {
    reviewReferenceMedia("IN-000001", "REF-000002", "approved");
    createProcurement("DM-000001", { type: "cad", supplierId: "u-supplier2", dueDate: "2026-06-25", brief: "x" });
    expect(JSON.stringify(supplierTasks("u-supplier2"))).toContain("lineup-pendant.png");
  });

  it("minorRevision 주석이 다음 CAD 태스크의 revision 브리프로 전달된다", () => {
    const r1 = addCadVersion("DM-000001", { fileUrl: "/cad-v1.png", supplierId: "u-supplier2" });
    decideCad(r1.id, { decision: "minorRevision", annotations: [
      { pinId: 1, x: 30, y: 60, part: "band", chipKey: "thinner", value: 1.6 },
    ] }, "customer");
    createProcurement("DM-000001", { type: "cad", supplierId: "u-supplier2", dueDate: "2026-06-26", brief: "v2" });
    const task = supplierTasks("u-supplier2").find((x) => x.brief === "v2");
    expect(task.revision.fileUrl).toBe("/cad-v1.png");
    expect(task.revision.annotations[0].chipKey).toBe("thinner");
  });
});
