// 요청 스펙 카드 — 고객이 인테이크에서 고른 총캐럿·퀄리티 허용 범위를
// 주문 포털에서 읽기전용 range 바로 다시 보여준다 (위저드와 동일한 비주얼 문법).
// 레거시 단일값(color: "E")은 [v,v] range로 승격해 표시, 값이 아예 없으면 해당 바 생략.
import { GradeRangeBar } from "./intake/pickers.jsx";
import {
  CLARITY_SCALE, COLOR_SCALE, MULTI_CLARITY_DEFAULT, MULTI_COLOR_DEFAULT,
  clampGradeRange,
} from "../lib/gradeScale.js";

export default function RequestedSpecCard({ spec, p }) {
  const g = p.intake.gflow;
  const sp = spec?.stonePrefs || null;
  const ms = spec?.multiSpec || null;
  const src = sp || ms;
  if (!src) return null;

  const colorRange = (src.colorRange || src.color)
    ? clampGradeRange(COLOR_SCALE, src.colorRange ?? src.color, MULTI_COLOR_DEFAULT)
    : null;
  const clarityRange = (src.clarityRange || src.clarity)
    ? clampGradeRange(CLARITY_SCALE, src.clarityRange ?? src.clarity, MULTI_CLARITY_DEFAULT)
    : null;
  const headline = sp
    ? [p.shapes?.[sp.shape] || sp.shape, sp.carat && `${Number(sp.carat).toFixed(2)}ct`].filter(Boolean).join(" · ")
    : [ms.totalCarat && `${Number(ms.totalCarat).toFixed(2)} ct`, g.totalCaratLbl].filter(Boolean).join(" — ");
  if (!headline && !colorRange && !clarityRange) return null;

  return (
    <div className="gflow-grange-fields" style={{ width: "100%" }}>
      {headline && <strong style={{ fontFamily: "var(--serif)", fontSize: 17 }}>{headline}</strong>}
      {colorRange && (
        <div className="field"><span>{g.colorRangeLbl}</span>
          <GradeRangeBar scale={COLOR_SCALE} value={colorRange} />
        </div>
      )}
      {clarityRange && (
        <div className="field"><span>{g.clarityRangeLbl}</span>
          <GradeRangeBar scale={CLARITY_SCALE} value={clarityRange} />
        </div>
      )}
    </div>
  );
}
