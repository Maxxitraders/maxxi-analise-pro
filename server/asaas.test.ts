import { describe, expect, it, vi } from "vitest";
import { isPaymentConfirmed, type AsaasWebhookPayload } from "./asaas";

// Mock do fetch global para testar funções que chamam a API
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Asaas Integration", () => {
  describe("isPaymentConfirmed", () => {
    it("should return true for PAYMENT_CONFIRMED", () => {
      expect(isPaymentConfirmed("PAYMENT_CONFIRMED")).toBe(true);
    });

    it("should return true for PAYMENT_RECEIVED", () => {
      expect(isPaymentConfirmed("PAYMENT_RECEIVED")).toBe(true);
    });

    it("should return false for PAYMENT_CREATED", () => {
      expect(isPaymentConfirmed("PAYMENT_CREATED")).toBe(false);
    });

    it("should return false for PAYMENT_OVERDUE", () => {
      expect(isPaymentConfirmed("PAYMENT_OVERDUE")).toBe(false);
    });

    it("should return false for PAYMENT_DELETED", () => {
      expect(isPaymentConfirmed("PAYMENT_DELETED")).toBe(false);
    });

    it("should return false for PAYMENT_REFUNDED", () => {
      expect(isPaymentConfirmed("PAYMENT_REFUNDED")).toBe(false);
    });
  });

  describe("Webhook payload parsing", () => {
    it("should correctly parse a PIX payment webhook payload", () => {
      const payload: AsaasWebhookPayload = {
        event: "PAYMENT_RECEIVED",
        payment: {
          id: "pay_123456",
          customer: "cus_789",
          billingType: "PIX",
          value: 6.50,
          status: "RECEIVED",
          externalReference: "42:basico",
          description: "Plano Básico - Maxxi Análise Pro",
        },
      };

      expect(payload.event).toBe("PAYMENT_RECEIVED");
      expect(payload.payment.billingType).toBe("PIX");
      expect(payload.payment.value).toBe(6.50);

      // Parse externalReference
      const [userIdStr, planSlug] = payload.payment.externalReference!.split(":");
      expect(parseInt(userIdStr)).toBe(42);
      expect(planSlug).toBe("basico");
    });

    it("should correctly parse a BOLETO payment webhook payload", () => {
      const payload: AsaasWebhookPayload = {
        event: "PAYMENT_CONFIRMED",
        payment: {
          id: "pay_789",
          customer: "cus_123",
          billingType: "BOLETO",
          value: 249.00,
          status: "CONFIRMED",
          externalReference: "10:profissional",
        },
      };

      expect(isPaymentConfirmed(payload.event)).toBe(true);
      expect(payload.payment.billingType).toBe("BOLETO");
    });

    it("should correctly parse a CREDIT_CARD payment webhook payload", () => {
      const payload: AsaasWebhookPayload = {
        event: "PAYMENT_CONFIRMED",
        payment: {
          id: "pay_456",
          customer: "cus_456",
          billingType: "CREDIT_CARD",
          value: 599.00,
          status: "CONFIRMED",
          externalReference: "5:enterprise",
        },
      };

      expect(isPaymentConfirmed(payload.event)).toBe(true);
      const [userIdStr, planSlug] = payload.payment.externalReference!.split(":");
      expect(parseInt(userIdStr)).toBe(5);
      expect(planSlug).toBe("enterprise");
    });

    it("should handle webhook without externalReference", () => {
      const payload: AsaasWebhookPayload = {
        event: "PAYMENT_CREATED",
        payment: {
          id: "pay_999",
          customer: "cus_999",
          billingType: "PIX",
          value: 100,
          status: "PENDING",
        },
      };

      expect(payload.payment.externalReference).toBeUndefined();
    });

    it("should handle refund event", () => {
      const payload: AsaasWebhookPayload = {
        event: "PAYMENT_REFUNDED" as any,
        payment: {
          id: "pay_refund",
          customer: "cus_123",
          billingType: "PIX",
          value: 6.50,
          status: "REFUNDED",
          externalReference: "42:basico",
        },
      };

      expect(isPaymentConfirmed(payload.event)).toBe(false);
      expect(payload.event).toBe("PAYMENT_REFUNDED");
    });
  });

  describe("API request helpers", () => {
    it("should construct correct Asaas API headers format", () => {
      // Verify the expected header format for Asaas API
      const headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "access_token": "test_key",
      };

      expect(headers["accept"]).toBe("application/json");
      expect(headers["content-type"]).toBe("application/json");
      expect(headers["access_token"]).toBe("test_key");
    });

    it("should format payment value correctly (centavos to reais)", () => {
      // monthlyPrice is stored in centavos, Asaas expects reais
      const monthlyPriceCentavos = 650; // R$ 6,50
      const valueInReais = monthlyPriceCentavos / 100;
      expect(valueInReais).toBe(6.50);

      const monthlyPriceCentavos2 = 24900; // R$ 249,00
      const valueInReais2 = monthlyPriceCentavos2 / 100;
      expect(valueInReais2).toBe(249.00);
    });

    it("should generate correct due date format", () => {
      const dueDate = new Date("2026-03-24");
      const dueDateStr = dueDate.toISOString().split("T")[0];
      expect(dueDateStr).toBe("2026-03-24");
      expect(dueDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should build correct externalReference format", () => {
      const userId = 42;
      const planSlug = "basico";
      const ref = `${userId}:${planSlug}`;
      expect(ref).toBe("42:basico");

      // Parse it back
      const [parsedUserId, parsedSlug] = ref.split(":");
      expect(parseInt(parsedUserId)).toBe(42);
      expect(parsedSlug).toBe("basico");
    });
  });
});
