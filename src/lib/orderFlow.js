// 실주문 콘솔 스텝 게이트 — 어드민이 순서를 건너뛰거나 고객 응답 전에 다음 단계를
// 발사하지 못하게 잠근다. (예: 제안 승인 전 "디파짓 수령" 클릭 방지)
// 판정 재료: firedTypes(타임라인에 실제 발사된 이벤트) + actions(고객 컨펌 원장).
const APPROVED_RESPONSES = new Set(["APPROVE", "CONFIRM"]);

export function stepGate(flow, index, firedTypes, actions) {
  const prev = flow.slice(0, index);
  const seqReady = prev.every((s) => firedTypes.has(s.type));
  // 같은 kind가 여러 번 발행될 수 있다(수정 제안 재발송) — 최신 액션의 응답만이 진실
  const approved = (kind) => {
    const latest = actions
      .filter((a) => a.kind === kind)
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0];
    return latest?.status === "RESPONDED" && APPROVED_RESPONSES.has(latest.responsePayload?.response);
  };
  const awaitingCustomer = seqReady && prev.some((s) => s.action && !approved(s.action.kind));
  return { seqReady, awaitingCustomer, locked: !seqReady || awaitingCustomer };
}
