import { ApiError } from "./errors.js";

const SEQUENCE_BY_PREFIX = {
  CUS: "customer_code_seq",
  IN: "intake_code_seq",
  BD: "order_code_seq",
  ACT: "action_code_seq",
  ART: "artifact_code_seq",
  TL: "timeline_code_seq",
  MED: "media_code_seq",
  REV: "review_code_seq",
};

export async function nextCode(client, prefix) {
  const sequence = SEQUENCE_BY_PREFIX[prefix];
  if (!sequence) throw new ApiError("BAD_CODE_PREFIX", 500);
  const { rows } = await client.query(`select nextval('${sequence}') as value`);
  return `${prefix}-${String(rows[0].value).padStart(6, "0")}`;
}
