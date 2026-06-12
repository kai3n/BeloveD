const MASK = "[차단됨]";

const PATTERNS = [
  /https?:\/\/\S+/gi,
  /\bwww\.\S+/gi,
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  // 8자리 이상 숫자(구분자 포함) — 전화번호
  /\+?\d[\d\s().-]{6,}\d/g,
  // 메신저/SNS 키워드 + 아이디 (\b는 한글에 동작하지 않으므로 사용하지 않음)
  /(?:카톡|카카오톡?|kakao|insta(?:gram)?|인스타|telegram|텔레그램|wechat|위챗|line|라인)\s*(?:id|아이디)?\s*[:@]?\s*[A-Za-z0-9._-]{3,}/gi,
  /@[A-Za-z0-9._]{3,}/g,
];

export function maskContacts(text) {
  if (!text) return text;
  return PATTERNS.reduce((out, re) => out.replace(re, MASK), String(text));
}
