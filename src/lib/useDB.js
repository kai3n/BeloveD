import { useEffect, useState } from "react";
import { subscribe } from "./store.js";

// 스토어 변경 시 리렌더 트리거. 페이지는 이 훅 호출 후 store API를 직접 읽는다.
export function useDBVersion() {
  const [, setVersion] = useState(0);
  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);
}
