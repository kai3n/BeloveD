export const STATUSES = [
  "DRAFT", "SUBMITTED", "VENDOR_ASSIGNED", "PROPOSAL_UPLOADED", "REVISION_REQUESTED",
  "CONFIRMED", "DEPOSIT_PAID", "IN_PRODUCTION", "QUALITY_CHECK", "FINAL_PAYMENT_PAID",
  "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "ON_HOLD",
];

// to 상태 기준 허용 규칙: 어떤 from에서, 어떤 역할이 일으킬 수 있는가
const TRANSITIONS = {
  SUBMITTED: { from: ["DRAFT"], roles: ["customer"] },
  VENDOR_ASSIGNED: { from: ["SUBMITTED", "ON_HOLD"], roles: ["admin"] },
  PROPOSAL_UPLOADED: { from: ["VENDOR_ASSIGNED", "REVISION_REQUESTED"], roles: ["vendor"] },
  REVISION_REQUESTED: { from: ["PROPOSAL_UPLOADED"], roles: ["customer"] },
  CONFIRMED: { from: ["PROPOSAL_UPLOADED"], roles: ["customer"] },
  DEPOSIT_PAID: { from: ["CONFIRMED"], roles: ["customer", "system"] },
  IN_PRODUCTION: { from: ["DEPOSIT_PAID", "QUALITY_CHECK"], roles: ["vendor", "admin"] },
  QUALITY_CHECK: { from: ["IN_PRODUCTION"], roles: ["vendor", "admin"] },
  FINAL_PAYMENT_PAID: { from: ["QUALITY_CHECK"], roles: ["customer", "system"] },
  SHIPPED: { from: ["FINAL_PAYMENT_PAID"], roles: ["admin"] },
  DELIVERED: { from: ["SHIPPED"], roles: ["admin", "system"] },
  COMPLETED: { from: ["DELIVERED"], roles: ["customer", "system"] },
  ON_HOLD: { from: ["CONFIRMED"], roles: ["admin", "system"] },
};

const CUSTOMER_CANCELLABLE = [
  "SUBMITTED", "VENDOR_ASSIGNED", "PROPOSAL_UPLOADED", "REVISION_REQUESTED", "CONFIRMED",
];

export function canTransition(from, to, role) {
  if (to === "CANCELLED") {
    if (role === "admin") return from !== "COMPLETED" && from !== "CANCELLED";
    if (role === "customer") return CUSTOMER_CANCELLABLE.includes(from);
    return false;
  }
  const rule = TRANSITIONS[to];
  if (!rule) return false;
  return rule.from.includes(from) && rule.roles.includes(role);
}

export function assertTransition(from, to, role) {
  if (!canTransition(from, to, role)) {
    throw new Error(`Invalid transition ${from} -> ${to} by ${role}`);
  }
}
