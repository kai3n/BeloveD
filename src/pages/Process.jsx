import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLocale } from "../i18n.jsx";

const processCopy = {
  en: {
    label: "HOW CUSTOM WORKS",
    title: "A luxury purchase, with a clear workspace behind it.",
    body: "Browse like a jewelry store. Order like a private atelier. Every quote, CAD version, image, video, and approval stays in one place.",
    explore: "Explore designs",
    workspaceLabel: "ORDER WORKSPACE",
    workspaceTitle: "Always know what is next.",
    workspaceBody: "Each order highlights the current stage, who is responsible, the next action, the latest media version, and the expected timing.",
    stages: [
      ["1. Design brief", "Choose a starter design or upload references. We capture size, metal, stone preferences, date, and budget.", "Customer submits request"],
      ["2. Quote and CAD", "The BeloveD team receives a production-ready brief and returns quotes, CAD, renders, photos, or videos through the order workspace.", "Team uploads versions"],
      ["3. Approval", "The customer reviews each version, leaves precise notes, and approves the design before production starts.", "Customer approves"],
      ["4. QC and delivery", "Final media, certification, balance, and shipping status stay attached to the same order timeline.", "Final approval and shipment"],
    ],
  },
  ko: {
    label: "주문제작 방식",
    title: "럭셔리 구매 경험에, 명확한 워크스페이스를 더합니다.",
    body: "주얼리 쇼핑몰처럼 고르고, 프라이빗 아틀리에처럼 주문하세요. 견적, CAD, 이미지, 영상, 승인 이력이 한 곳에 남습니다.",
    explore: "디자인 보기",
    workspaceLabel: "주문 워크스페이스",
    workspaceTitle: "다음 단계를 늘 명확하게.",
    workspaceBody: "각 주문은 현재 단계, 담당자, 다음 액션, 최신 미디어 버전, 예상 일정을 한 화면에 보여줍니다.",
    stages: [
      ["1. 디자인 브리프", "시작 디자인을 고르거나 레퍼런스를 업로드하세요. 사이즈, 메탈, 스톤 선호, 날짜, 예산을 정리합니다.", "고객 요청 제출"],
      ["2. 견적 및 CAD", "BeloveD 제작팀이 제작 가능한 브리프를 받고, 워크스페이스에 견적, CAD, 렌더, 사진, 영상을 업로드합니다.", "제작팀 버전 업로드"],
      ["3. 승인", "고객은 각 버전을 검토하고 코멘트를 남긴 뒤 제작 전 디자인을 승인합니다.", "고객 승인"],
      ["4. QC 및 배송", "최종 미디어, 인증서, 잔금, 배송 상태가 같은 주문 타임라인에 연결됩니다.", "최종 승인 및 배송"],
    ],
  },
  zh: {
    label: "定制流程",
    title: "奢华购买体验，也要有清晰的订单工作区。",
    body: "像浏览珠宝店一样挑选，像私人工作室一样下单。报价、CAD、图片、视频与确认记录都保留在同一处。",
    explore: "查看设计",
    workspaceLabel: "订单工作区",
    workspaceTitle: "下一步始终清楚。",
    workspaceBody: "每个订单都会显示当前阶段、负责人、下一步、最新媒体版本和预计时间。",
    stages: [
      ["1. 设计需求", "选择起始设计或上传参考图。我们整理尺寸、金属、钻石偏好、日期和预算。", "客户提交需求"],
      ["2. 报价与 CAD", "BeloveD 团队收到可生产的需求，并在工作区返回报价、CAD、渲染图、照片或视频。", "团队上传版本"],
      ["3. 确认", "客户逐版查看、留下明确意见，并在生产前确认设计。", "客户确认"],
      ["4. 质检与交付", "最终媒体、证书、尾款和物流状态都保留在同一订单时间线。", "最终确认与发货"],
    ],
  },
  es: {
    label: "CÓMO FUNCIONA",
    title: "Una compra de lujo, con un espacio claro detrás.",
    body: "Explora como en una joyería. Encarga como en un atelier privado. Cotización, CAD, imágenes, videos y aprobaciones quedan en un solo lugar.",
    explore: "Ver diseños",
    workspaceLabel: "ESPACIO DEL PEDIDO",
    workspaceTitle: "Siempre sabes qué sigue.",
    workspaceBody: "Cada pedido muestra etapa actual, responsable, siguiente acción, última versión de medios y tiempos esperados.",
    stages: [
      ["1. Brief de diseño", "Elige un diseño base o sube referencias. Capturamos talla, metal, piedra, fecha y presupuesto.", "Cliente envía solicitud"],
      ["2. Cotización y CAD", "El taller recibe un brief listo para producción y devuelve cotizaciones, CAD, renders, fotos o videos en el espacio del pedido.", "Taller sube versiones"],
      ["3. Aprobación", "El cliente revisa cada versión, deja notas precisas y aprueba el diseño antes de producir.", "Cliente aprueba"],
      ["4. QC y entrega", "Medios finales, certificado, saldo y envío permanecen ligados a la misma línea de tiempo.", "Aprobación final y envío"],
    ],
  },
};

// 단계 제목의 "1. " 숫자 프리픽스는 에디토리얼 넘버링(01–04)으로 따로 그린다
const stripStageNumber = (title) => title.replace(/^\d+\.\s*/, "");

export default function Process() {
  const { locale, p } = useLocale();
  const copy = processCopy[locale] ?? processCopy.en;

  return (
    <div className="page proc-noir-page">
      <section className="proc-noir-head">
        <span className="noir-eyebrow">{copy.label}</span>
        <h1>{copy.title}</h1>
        <p className="proc-noir-sub">{copy.body}</p>
        <div className="proc-noir-ctas">
          <Link className="noir-btn" to="/custom/new">
            {p.nav.startCustom}
            <ArrowRight size={15} strokeWidth={1.6} />
          </Link>
          <Link className="noir-link" to="/designs">{copy.explore}</Link>
        </div>
      </section>

      <section className="proc-noir-stages">
        {copy.stages.map(([title, body, action], index) => (
          <article className="proc-noir-stage" key={title}>
            <span className="proc-noir-no">{String(index + 1).padStart(2, "0")}</span>
            <div className="proc-noir-stage-copy">
              <h2>{stripStageNumber(title)}</h2>
              <p>{body}</p>
            </div>
            <span className="proc-noir-action">{action}</span>
          </article>
        ))}
      </section>

      <section className="proc-noir-workspace">
        <span className="noir-eyebrow">{copy.workspaceLabel}</span>
        <h2>{copy.workspaceTitle}</h2>
        <p>{copy.workspaceBody}</p>
        <Link className="noir-btn" to="/custom/new">
          {p.nav.startCustom}
          <ArrowRight size={15} strokeWidth={1.6} />
        </Link>
      </section>
    </div>
  );
}
