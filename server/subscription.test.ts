import { describe, expect, it } from "vitest";
import {
  getActivePlans,
  getAllPlans,
  getPlanBySlug,
  formatPrice,
  type PlanData,
} from "./products";

describe("Products & Plans (Database-backed)", () => {
  it("should retrieve active plans from database", async () => {
    const activePlans = await getActivePlans();
    expect(activePlans.length).toBeGreaterThanOrEqual(1);
  });

  it("should retrieve all plans from database", async () => {
    const allPlans = await getAllPlans();
    expect(allPlans.length).toBeGreaterThanOrEqual(1);
  });

  it("each plan should have required fields", async () => {
    const plans = await getAllPlans();
    for (const plan of plans) {
      expect(plan.id).toBeTruthy(); // slug
      expect(plan.dbId).toBeGreaterThan(0);
      expect(plan.name).toBeTruthy();
      expect(typeof plan.monthlyPrice).toBe("number");
      expect(plan.monthlyPrice).toBeGreaterThanOrEqual(0);
      expect(typeof plan.consultasLimit).toBe("number");
      expect(Array.isArray(plan.features)).toBe(true);
      expect(plan.features.length).toBeGreaterThan(0);
      expect(typeof plan.active).toBe("boolean");
    }
  });

  it("should retrieve plan by slug", async () => {
    const basico = await getPlanBySlug("basico");
    expect(basico).toBeDefined();
    expect(basico?.name).toBe("B\u00e1sico");

    const profissional = await getPlanBySlug("profissional");
    expect(profissional).toBeDefined();
    expect(profissional?.name).toBe("Profissional");

    const enterprise = await getPlanBySlug("enterprise");
    expect(enterprise).toBeDefined();
    expect(enterprise?.name).toBe("Enterprise");
  });

  it("should return undefined for unknown plan slug", async () => {
    const unknown = await getPlanBySlug("nonexistent");
    expect(unknown).toBeUndefined();
  });

  it("should format prices correctly in BRL", () => {
    expect(formatPrice(9900)).toBe("R$ 99,00");
    expect(formatPrice(19900)).toBe("R$ 199,00");
    expect(formatPrice(49900)).toBe("R$ 499,00");
    expect(formatPrice(0)).toBe("R$ 0,00");
  });

  it("active plans should be sorted by sortOrder", async () => {
    const plans = await getActivePlans();
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].sortOrder).toBeGreaterThanOrEqual(plans[i - 1].sortOrder);
    }
  });

  it("at most one plan should be marked as popular", async () => {
    const plans = await getAllPlans();
    const popularPlans = plans.filter((p: PlanData) => p.popular);
    expect(popularPlans.length).toBeLessThanOrEqual(1);
  });

  it("plans should have valid PlanData structure", async () => {
    const plans = await getAllPlans();
    for (const plan of plans) {
      // Check that id (slug) matches expected format
      expect(plan.id).toMatch(/^[a-z0-9_-]+$/);
      // Check that features is an array of strings
      for (const feature of plan.features) {
        expect(typeof feature).toBe("string");
      }
    }
  });
});
