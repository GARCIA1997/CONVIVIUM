import { client } from "@convivium/app-shell";

export interface Supplier { id: string; name: string; rfc: string | null; phone: string | null; email: string | null; creditDays: number }
export interface PurchaseOrder {
  id: string; folio: string; status: string; createdAt: string; expectedAt: string | null; supplierId: string;
  supplier: Supplier; total: number;
  lines: { id: string; ingredientId: string; name: string; purchaseUnit: string; quantity: number; unitPrice: number; amount: number }[];
}
export type Suggestion = Awaited<ReturnType<typeof client.inventory.suggestions>>[number];
export interface Payable {
  id: string; supplierId: string; supplier: string; folio: string | null; receivedAt: string | null; dueAt: string;
  amount: number; balance: number; status: string; state: "vencida" | "por_vencer" | "parcial" | "al_corriente" | "pagada"; daysToDue: number;
  payments: { amount: number; method: string; reference: string | null; at: string }[];
}
export interface CfdiParsed {
  emisor: { rfc: string | null; name: string | null }; supplierId: string | null; folio: string | null; uuid: string | null; total: number;
  conceptos: { description: string; quantity: number; unit: string; unitPrice: number; amount: number; ingredientId: string | null }[];
}

/** Compras y cuentas por pagar (E8). */
export const PurchasingApi = {
  suppliers: () => client.request<(Supplier & { balance: number })[]>("GET", "/purchasing/suppliers"),
  orders: (status?: string) => client.request<PurchaseOrder[]>("GET", `/purchasing/purchase-orders${status ? `?status=${status}` : ""}`),
  order: (id: string) => client.request<PurchaseOrder>("GET", `/purchasing/purchase-orders/${id}`),
  createOrder: (body: { supplierId: string; warehouseId: string; lines: { ingredientId: string; quantity: number; unitPrice: number }[] }) => client.request<PurchaseOrder>("POST", "/purchasing/purchase-orders", body),
  approve: (id: string) => client.request<PurchaseOrder>("POST", `/purchasing/purchase-orders/${id}/approve`),
  share: (id: string) => client.request<{ text: string; whatsappUrl: string; mailto: string }>("POST", `/purchasing/purchase-orders/${id}/share`),
  receive: (body: unknown) => client.request<{ receiptId: string; total: number; payable: { id: string; dueAt: string } | null }>("POST", "/purchasing/receipts", body),
  parseCfdi: (xml: string) => client.request<CfdiParsed>("POST", "/purchasing/receipts/parse-cfdi", { xml }),
  payables: () => client.request<Payable[]>("GET", "/purchasing/payables"),
  pay: (body: { payableId: string; amount: number; method: "transferencia" | "efectivo_caja" | "cheque"; reference?: string }) => client.request<{ balance: number; status: string }>("POST", "/purchasing/payables/payments", body),
};
