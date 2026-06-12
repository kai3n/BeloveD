// 딜러 네트워크 채널 문자열 — 4개 언어 (diamond_qc.pdf 기반)

const en = {
  ftc: "Laboratory-Grown Diamonds. All stones are lab-created and ship with an IGI (or equivalent) certificate.",
  dealerApply: {
    title: "Authorized Dealer Program", sub: "Buy at wholesale, sell under the LUMINA LAB brand. Tier pricing is based purely on purchase volume — no recruiting, no buy-ins.",
    bizName: "Business name", contactName: "Contact name", email: "Email", city: "City / State",
    permitNo: "Seller's permit no.", resaleCertNo: "Resale certificate no. (required before first order)",
    expected: "Expected quarterly volume ($)", submit: "Apply",
    done: "Application received. We review and reply by email within a few business days.",
    note: "A seller's permit and resale certificate are required before your first wholesale order.",
  },
  dealer: {
    title: "Dealer Portal",
    nav: { dashboard: "Dashboard", catalog: "Wholesale Catalog", orders: "Orders", regs: "Warranty Registrations", claims: "Claims", policies: "Policies" },
    dash: {
      tier: "Current tier", tierName: (t) => `Tier ${t}`, override: "(manual override)",
      volume: "This quarter's purchases", threshold: (v) => `Tier 1 threshold: ${v}`,
      demotionWarn: "Two consecutive quarters below threshold returns you to Tier 2.",
      cert: "Resale certificate", certOk: "On file", certMissing: "Missing — ordering is blocked until provided",
      spot: "Today's gold spot (per gram)",
    },
    catalog: {
      title: "Wholesale Catalog", msrp: "MSRP", yourPrice: (t) => `Your price (Tier ${t})`,
      stone: "Stone", metal: "Metal (live)", metalNote: (g, spot) => `${g}g × $${spot}/g × 75% + labor — locked at order time`,
      nonResizable: "Not resizable", order: "Order",
    },
    orderNew: {
      title: "New Wholesale Order", qty: "Qty", shipTo: "Ship to",
      toDealer: "My address (dealer)", toBuyer: "End buyer (dropship)",
      name: "Recipient name", address: "Address", total: "Total",
      quoteNote: "Metal priced at today's gold spot and locked for this order.",
      certBlocked: "A resale certificate is required before your first wholesale order. Contact us to update your file.",
      submit: "Place order", empty: "Select at least one piece.",
    },
    orders: {
      title: "Wholesale Orders", order: "Order", date: "Date", total: "Total", tracking: "Tracking",
      qc: "QC photos", empty: "No orders yet.",
      st: { PLACED: "Placed", QC_PASSED: "QC passed", SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled" },
    },
    regs: {
      title: "Warranty Registrations",
      sub: "Every sale requires the end buyer's name and contact to activate the 12-month warranty. We never market to your registered customers.",
      item: "Piece", buyer: "Buyer", contact: "Contact", soldAt: "Sale date", until: "Warranty until",
      submit: "Register", empty: "No registrations yet.",
    },
    claims: {
      title: "Quality Claims", newClaim: "New claim",
      sub: "Quality defects are on us — remedy is replacement, conditional on return of the defective piece (prepaid label).",
      reg: "Warranty registration", defect: "Defect type", desc: "Description (contacts/links blocked)",
      photos: "Photos / video", submit: "Submit claim", empty: "No claims.",
      types: { certMismatch: "Stone ≠ certificate", setting: "Setting defect", stoneLoss: "Stone loss (normal wear)", casting: "Casting flaw", plating: "Plating failure" },
      st: { SUBMITTED: "Submitted", DENIED: "Denied", AWAITING_RETURN: "Approved — awaiting return", RETURN_RECEIVED: "Return received", REPLACED: "Replacement shipped" },
      returnNote: "Ship the defective piece to the CA warehouse with the prepaid label.",
    },
    policies: {
      title: "Dealer Handbook",
      blocks: [
        ["MSRP & MAP", "MSRP is suggested, never mandated. The MAP policy restricts advertised prices only — your transaction price is always yours. Advertising below MAP may end supply."],
        ["Returns (recommended)", "Made-to-order pieces: Final Sale, disclosed before purchase, quality defects excepted. Standard catalog: 30-day returns with a 20% restocking fee, or fee-free exchange / store credit."],
        ["Sizing", "Mail the plastic ring sizer before confirming an order. Non-resizable styles are flagged on each product. Third-party work voids the setting/metal warranty — the stone warranty survives."],
        ["Warranty", "12-month manufacturing-defect warranty: cosmetic defects within 7 days of delivery, setting failure within 12 months. Wear-and-maintenance (replating, polishing, prong tightening) are paid services."],
        ["Quality claims", "Your end buyer contacts only you. Submit photos/video to us; we adjudicate; remedy is replacement, conditional on return of the defective piece."],
        ["FTC disclosure", "Every product description and ad must state 'laboratory-grown'. Blurring the natural/lab line is grounds for termination."],
      ],
    },
  },
  adminDealer: {
    menu: { dealers: "Dealers", catalog: "Wholesale Catalog", wholesale: "Wholesale Orders", claims: "Claims & Salvage", warranty: "Warranty Registry" },
    apps: { title: "Dealer Applications", approve: "Approve", reject: "Reject", expected: "Expected/qtr", empty: "No pending applications.", st: { pending: "Pending", approved: "Approved", rejected: "Rejected" } },
    dealers: {
      title: "Dealers", tier: "Tier", volume: "Qtr volume", cert: "Resale cert", certMissing: "missing",
      override: "Override", none: "Auto", active: "Active", suspended: "Suspended", city: "City",
    },
    catalog: {
      title: "Wholesale SKUs", goldSpot: "Gold spot ($/g)", applied: "Applies to new orders immediately.",
      msrp: "MSRP", t1: "Stone T1", t2: "Stone T2", grams: "Metal (g)", labor: "Labor", resizable: "Resizable",
      yes: "Yes", no: "No", newTitle: "Add SKU", name: "Name",
    },
    wholesale: {
      title: "Wholesale Orders", dealer: "Dealer", attach: "Attach QC photos (required)",
      pass: "QC pass", ship: "Ship", deliver: "Mark delivered", cancel: "Cancel", trackingPh: "Tracking no.",
      shipToLbl: "Ship to", spotAt: (s) => `Gold spot at order: $${s}/g`,
    },
    claims: {
      title: "Claims Adjudication", approve: "Approve (replace)", deny: "Deny", note: "Adjudication note",
      receive: "Receive return", goldGrams: "Recovered gold (g)", stonePool: "Stone back to pool",
      credit: "Salvage credit", replaced: "Replacement shipped",
      salvageTitle: "Salvage Ledger", quarterTotal: (q, g, c) => `${q}: ${g}g recovered · credit ${c}`,
      photoEvidence: "Photo evidence",
    },
    warranty: { title: "Warranty Registry", note: "We hold the data; the customer relationship stays with the dealer. No direct marketing — contractual.", dealer: "Dealer" },
    settings: { tierThreshold: "Tier 1 quarterly threshold ($)", goldSpot: "Gold spot ($/g)" },
  },
};

const ko = {
  ftc: "Laboratory-Grown Diamonds — 전 스톤 랩그로운이며 IGI(급) 인증서가 동봉됩니다.",
  dealerApply: {
    title: "공인 딜러 프로그램", sub: "도매가로 매입해 LUMINA LAB 브랜드로 판매하세요. 티어는 순수 구매량 기준 — 모집 보상도, 바이인도 없습니다.",
    bizName: "사업자명", contactName: "담당자", email: "이메일", city: "도시 / 주",
    permitNo: "Seller's permit 번호", resaleCertNo: "Resale certificate 번호 (첫 주문 전 필수)",
    expected: "예상 분기 매입액 ($)", submit: "지원하기",
    done: "지원서가 접수되었습니다. 영업일 기준 수일 내 이메일로 회신드립니다.",
    note: "첫 도매 주문 전 seller's permit과 resale certificate가 필요합니다.",
  },
  dealer: {
    title: "딜러 포털",
    nav: { dashboard: "대시보드", catalog: "도매 카탈로그", orders: "주문", regs: "보증 등록", claims: "클레임", policies: "정책" },
    dash: {
      tier: "현재 티어", tierName: (t) => `Tier ${t}`, override: "(수동 지정)",
      volume: "이번 분기 매입액", threshold: (v) => `Tier 1 기준: ${v}`,
      demotionWarn: "2분기 연속 기준 미달 시 Tier 2로 조정됩니다.",
      cert: "Resale certificate", certOk: "등록됨", certMissing: "미등록 — 등록 전까지 주문이 차단됩니다",
      spot: "오늘의 금 시세 (g당)",
    },
    catalog: {
      title: "도매 카탈로그", msrp: "MSRP", yourPrice: (t) => `내 도매가 (Tier ${t})`,
      stone: "스톤", metal: "메탈 (변동)", metalNote: (g, spot) => `${g}g × $${spot}/g × 75% + 공임 — 주문 시점에 고정`,
      nonResizable: "리사이즈 불가", order: "주문하기",
    },
    orderNew: {
      title: "도매 주문", qty: "수량", shipTo: "배송지",
      toDealer: "내 주소 (딜러)", toBuyer: "최종 구매자 직배송 (드롭쉽)",
      name: "수령인", address: "주소", total: "합계",
      quoteNote: "메탈은 오늘의 금 시세로 계산되어 이 주문에 고정됩니다.",
      certBlocked: "첫 도매 주문 전 resale certificate 등록이 필요합니다. 운영팀에 등록을 요청하세요.",
      submit: "주문하기", empty: "최소 1개 피스를 선택하세요.",
    },
    orders: {
      title: "도매 주문 내역", order: "주문", date: "일자", total: "합계", tracking: "운송장",
      qc: "QC 사진", empty: "주문이 없습니다.",
      st: { PLACED: "접수", QC_PASSED: "QC 통과", SHIPPED: "배송중", DELIVERED: "배송완료", CANCELLED: "취소" },
    },
    regs: {
      title: "보증 등록",
      sub: "모든 판매는 최종 구매자 이름·연락처 등록으로 12개월 보증이 활성화됩니다. 등록 고객에게 우리가 직접 마케팅하는 일은 없습니다.",
      item: "피스", buyer: "구매자", contact: "연락처", soldAt: "판매일", until: "보증 만료",
      submit: "등록", empty: "등록 내역이 없습니다.",
    },
    claims: {
      title: "품질 클레임", newClaim: "새 클레임",
      sub: "품질 결함은 본사 책임입니다 — 수리가 아닌 교체로 처리하며, 불량품 반환(선불 라벨)이 조건입니다.",
      reg: "보증 등록 건", defect: "결함 유형", desc: "설명 (연락처·링크 자동 차단)",
      photos: "사진 / 영상", submit: "클레임 제출", empty: "클레임이 없습니다.",
      types: { certMismatch: "스톤-인증서 불일치", setting: "세팅 결함", stoneLoss: "스톤 분실 (정상 착용)", casting: "주조 결함", plating: "도금 불량" },
      st: { SUBMITTED: "제출됨", DENIED: "반려", AWAITING_RETURN: "승인 — 반환 대기", RETURN_RECEIVED: "반환 수령", REPLACED: "교체품 발송" },
      returnNote: "선불 라벨로 불량품을 CA 창고로 보내주세요.",
    },
    policies: {
      title: "딜러 핸드북",
      blocks: [
        ["MSRP & MAP", "MSRP는 권장가일 뿐 강제하지 않습니다. MAP 정책은 광고 표시가만 제한하며 실제 판매가는 항상 딜러의 자유입니다. MAP 미만 광고는 공급 중단 사유가 될 수 있습니다."],
        ["반품 (권장 정책)", "주문제작: Final Sale — 구매 전 명시, 품질 결함은 예외. 카탈로그 기성품: 30일 반품 + 재입고비 20%, 또는 무료 교환/스토어 크레딧."],
        ["사이징", "주문 확정 전 플라스틱 링 사이저를 발송하세요. 리사이즈 불가 스타일은 제품에 표시됩니다. 제3자 가공은 세팅/메탈 보증을 무효화합니다 — 스톤 보증은 유지."],
        ["보증", "12개월 제조 결함 보증: 외관 결함은 배송 후 7일, 세팅 불량은 12개월. 마모·유지보수(재도금·폴리싱·프롱 조임)는 유료 서비스입니다."],
        ["품질 클레임", "최종 구매자는 딜러에게만 연락합니다. 사진/영상으로 제출하면 본사가 판정하고, 불량품 반환 조건부 교체로 처리합니다."],
        ["FTC 고지", "모든 제품 설명·광고에 'laboratory-grown'을 명시해야 합니다. 천연/랩 경계를 흐리는 행위는 계약 해지 사유입니다."],
      ],
    },
  },
  adminDealer: {
    menu: { dealers: "딜러", catalog: "도매 카탈로그", wholesale: "도매 주문", claims: "클레임·샐비지", warranty: "보증 대장" },
    apps: { title: "딜러 지원서", approve: "승인", reject: "반려", expected: "예상/분기", empty: "대기 중인 지원서가 없습니다.", st: { pending: "대기", approved: "승인됨", rejected: "반려됨" } },
    dealers: {
      title: "딜러 목록", tier: "티어", volume: "분기 매입", cert: "Resale cert", certMissing: "미등록",
      override: "오버라이드", none: "자동", active: "활성", suspended: "정지", city: "도시",
    },
    catalog: {
      title: "도매 SKU", goldSpot: "금 시세 ($/g)", applied: "신규 주문에 즉시 적용됩니다.",
      msrp: "MSRP", t1: "스톤 T1", t2: "스톤 T2", grams: "메탈 (g)", labor: "공임", resizable: "리사이즈",
      yes: "가능", no: "불가", newTitle: "SKU 추가", name: "이름",
    },
    wholesale: {
      title: "도매 주문 처리", dealer: "딜러", attach: "QC 사진 첨부 (필수)",
      pass: "QC 통과", ship: "배송 시작", deliver: "배송완료 처리", cancel: "취소", trackingPh: "운송장 번호",
      shipToLbl: "배송지", spotAt: (s) => `주문 시점 금 시세: $${s}/g`,
    },
    claims: {
      title: "클레임 판정", approve: "승인 (교체)", deny: "반려", note: "판정 메모",
      receive: "반환 수령", goldGrams: "회수 골드 (g)", stonePool: "스톤 풀 복귀",
      credit: "샐비지 크레딧", replaced: "교체품 발송",
      salvageTitle: "샐비지 원장", quarterTotal: (q, g, c) => `${q}: 회수 ${g}g · 크레딧 ${c}`,
      photoEvidence: "사진 증빙",
    },
    warranty: { title: "보증 등록 대장", note: "데이터는 본사가 보관하고, 고객 관계는 딜러에게 있습니다. 직접 마케팅 금지 — 계약 사항.", dealer: "딜러" },
    settings: { tierThreshold: "Tier 1 분기 기준 ($)", goldSpot: "금 시세 ($/g)" },
  },
};

const zh = {
  ftc: "Laboratory-Grown Diamonds — 全部为实验室培育钻石，随附 IGI（或同级）证书。",
  dealerApply: {
    title: "授权经销商计划", sub: "以批发价采购，以 LUMINA LAB 品牌销售。等级完全基于采购量 — 无拉人奖励、无入会费。",
    bizName: "公司名称", contactName: "联系人", email: "邮箱", city: "城市 / 州",
    permitNo: "Seller's permit 编号", resaleCertNo: "Resale certificate 编号（首单前必须）",
    expected: "预计季度采购额 ($)", submit: "申请",
    done: "申请已收到。我们将在数个工作日内邮件回复。",
    note: "首次批发订单前需要 seller's permit 和 resale certificate。",
  },
  dealer: {
    title: "经销商门户",
    nav: { dashboard: "仪表盘", catalog: "批发目录", orders: "订单", regs: "保修登记", claims: "理赔", policies: "政策" },
    dash: {
      tier: "当前等级", tierName: (t) => `Tier ${t}`, override: "（手动指定）",
      volume: "本季度采购额", threshold: (v) => `Tier 1 门槛：${v}`,
      demotionWarn: "连续两个季度未达标将回到 Tier 2。",
      cert: "Resale certificate", certOk: "已登记", certMissing: "未登记 — 登记前无法下单",
      spot: "今日金价（每克）",
    },
    catalog: {
      title: "批发目录", msrp: "MSRP", yourPrice: (t) => `我的批发价（Tier ${t}）`,
      stone: "钻石", metal: "金属（浮动）", metalNote: (g, spot) => `${g}g × $${spot}/g × 75% + 工费 — 下单时锁定`,
      nonResizable: "不可改圈", order: "下单",
    },
    orderNew: {
      title: "批发订单", qty: "数量", shipTo: "收货地址",
      toDealer: "我的地址（经销商）", toBuyer: "终端买家直发（代发）",
      name: "收件人", address: "地址", total: "合计",
      quoteNote: "金属按今日金价计算并为本订单锁定。",
      certBlocked: "首单前需登记 resale certificate。请联系运营团队登记。",
      submit: "提交订单", empty: "请至少选择一件。",
    },
    orders: {
      title: "批发订单", order: "订单", date: "日期", total: "合计", tracking: "运单",
      qc: "QC 照片", empty: "暂无订单。",
      st: { PLACED: "已下单", QC_PASSED: "QC 通过", SHIPPED: "配送中", DELIVERED: "已送达", CANCELLED: "已取消" },
    },
    regs: {
      title: "保修登记",
      sub: "每笔销售须登记终端买家姓名与联系方式以激活 12 个月保修。我们绝不向您登记的客户直接营销。",
      item: "商品", buyer: "买家", contact: "联系方式", soldAt: "售出日期", until: "保修截止",
      submit: "登记", empty: "暂无登记。",
    },
    claims: {
      title: "质量理赔", newClaim: "新理赔",
      sub: "质量缺陷由品牌方负责 — 以换代修，以退回瑕疵品为条件（预付标签）。",
      reg: "保修登记", defect: "缺陷类型", desc: "说明（联系方式·链接自动屏蔽）",
      photos: "照片 / 视频", submit: "提交理赔", empty: "暂无理赔。",
      types: { certMismatch: "钻石与证书不符", setting: "镶嵌缺陷", stoneLoss: "正常佩戴掉石", casting: "铸造缺陷", plating: "电镀不良" },
      st: { SUBMITTED: "已提交", DENIED: "已驳回", AWAITING_RETURN: "已批准 — 等待退回", RETURN_RECEIVED: "已收到退件", REPLACED: "替换品已发出" },
      returnNote: "请用预付标签将瑕疵品寄回加州仓库。",
    },
    policies: {
      title: "经销商手册",
      blocks: [
        ["MSRP & MAP", "MSRP 仅为建议价，绝不强制。MAP 政策只限制广告标价，实际成交价始终由经销商决定。低于 MAP 的广告可能导致停止供货。"],
        ["退货（建议政策）", "定制商品：Final Sale — 购前明示，质量缺陷除外。标准目录商品：30 天退货 + 20% 重新入库费，或免费换货/商店积分。"],
        ["改圈", "确认订单前请先寄出塑料戒围圈。不可改圈的款式会在商品上标注。第三方加工将使镶嵌/金属保修失效 — 钻石保修仍然有效。"],
        ["保修", "12 个月制造缺陷保修：外观缺陷为送达后 7 天内，镶嵌失效为 12 个月内。磨损保养（重新电镀、抛光、紧爪）为付费服务。"],
        ["质量理赔", "终端买家只联系经销商。以照片/视频提交，品牌方裁定，以退回瑕疵品为条件进行替换。"],
        ["FTC 标注", "所有商品描述与广告必须标明 'laboratory-grown'。模糊天然/培育界限将构成解约事由。"],
      ],
    },
  },
  adminDealer: {
    menu: { dealers: "经销商", catalog: "批发目录", wholesale: "批发订单", claims: "理赔·回收", warranty: "保修台账" },
    apps: { title: "经销商申请", approve: "批准", reject: "驳回", expected: "预计/季度", empty: "暂无待审申请。", st: { pending: "待审", approved: "已批准", rejected: "已驳回" } },
    dealers: {
      title: "经销商列表", tier: "等级", volume: "季度采购", cert: "Resale cert", certMissing: "未登记",
      override: "手动指定", none: "自动", active: "启用", suspended: "停用", city: "城市",
    },
    catalog: {
      title: "批发 SKU", goldSpot: "金价 ($/g)", applied: "立即适用于新订单。",
      msrp: "MSRP", t1: "钻石 T1", t2: "钻石 T2", grams: "金属 (g)", labor: "工费", resizable: "可改圈",
      yes: "是", no: "否", newTitle: "新增 SKU", name: "名称",
    },
    wholesale: {
      title: "批发订单处理", dealer: "经销商", attach: "附加 QC 照片（必须）",
      pass: "QC 通过", ship: "发货", deliver: "标记送达", cancel: "取消", trackingPh: "运单号",
      shipToLbl: "收货地址", spotAt: (s) => `下单时金价：$${s}/g`,
    },
    claims: {
      title: "理赔裁定", approve: "批准（替换）", deny: "驳回", note: "裁定备注",
      receive: "收到退件", goldGrams: "回收黄金 (g)", stonePool: "钻石回库",
      credit: "回收抵扣", replaced: "替换品已发出",
      salvageTitle: "回收台账", quarterTotal: (q, g, c) => `${q}：回收 ${g}g · 抵扣 ${c}`,
      photoEvidence: "照片证据",
    },
    warranty: { title: "保修台账", note: "数据由品牌方保管，客户关系归经销商。禁止直接营销 — 合同约定。", dealer: "经销商" },
    settings: { tierThreshold: "Tier 1 季度门槛 ($)", goldSpot: "金价 ($/g)" },
  },
};

const es = {
  ftc: "Laboratory-Grown Diamonds — todas las piedras son cultivadas en laboratorio e incluyen certificado IGI (o equivalente).",
  dealerApply: {
    title: "Programa de Distribuidores Autorizados", sub: "Compra al por mayor y vende bajo la marca LUMINA LAB. El nivel se basa solo en volumen de compra — sin reclutamiento ni cuotas de entrada.",
    bizName: "Nombre del negocio", contactName: "Contacto", email: "Correo", city: "Ciudad / Estado",
    permitNo: "N.º de seller's permit", resaleCertNo: "N.º de resale certificate (requerido antes del primer pedido)",
    expected: "Volumen trimestral esperado ($)", submit: "Aplicar",
    done: "Solicitud recibida. Respondemos por correo en unos días hábiles.",
    note: "Se requieren seller's permit y resale certificate antes del primer pedido mayorista.",
  },
  dealer: {
    title: "Portal del Distribuidor",
    nav: { dashboard: "Panel", catalog: "Catálogo Mayorista", orders: "Pedidos", regs: "Registros de Garantía", claims: "Reclamos", policies: "Políticas" },
    dash: {
      tier: "Nivel actual", tierName: (t) => `Tier ${t}`, override: "(asignación manual)",
      volume: "Compras de este trimestre", threshold: (v) => `Umbral Tier 1: ${v}`,
      demotionWarn: "Dos trimestres consecutivos bajo el umbral te regresan a Tier 2.",
      cert: "Resale certificate", certOk: "Registrado", certMissing: "Falta — pedidos bloqueados hasta registrarlo",
      spot: "Precio del oro hoy (por gramo)",
    },
    catalog: {
      title: "Catálogo Mayorista", msrp: "MSRP", yourPrice: (t) => `Tu precio (Tier ${t})`,
      stone: "Piedra", metal: "Metal (variable)", metalNote: (g, spot) => `${g}g × $${spot}/g × 75% + mano de obra — fijado al ordenar`,
      nonResizable: "No ajustable", order: "Ordenar",
    },
    orderNew: {
      title: "Nuevo Pedido Mayorista", qty: "Cant.", shipTo: "Enviar a",
      toDealer: "Mi dirección (distribuidor)", toBuyer: "Comprador final (dropship)",
      name: "Destinatario", address: "Dirección", total: "Total",
      quoteNote: "El metal se cotiza al oro de hoy y queda fijado para este pedido.",
      certBlocked: "Se requiere resale certificate antes del primer pedido. Contáctanos para registrarlo.",
      submit: "Realizar pedido", empty: "Selecciona al menos una pieza.",
    },
    orders: {
      title: "Pedidos Mayoristas", order: "Pedido", date: "Fecha", total: "Total", tracking: "Guía",
      qc: "Fotos QC", empty: "Sin pedidos.",
      st: { PLACED: "Recibido", QC_PASSED: "QC aprobado", SHIPPED: "Enviado", DELIVERED: "Entregado", CANCELLED: "Cancelado" },
    },
    regs: {
      title: "Registros de Garantía",
      sub: "Cada venta requiere nombre y contacto del comprador final para activar la garantía de 12 meses. Nunca hacemos marketing directo a tus clientes registrados.",
      item: "Pieza", buyer: "Comprador", contact: "Contacto", soldAt: "Fecha de venta", until: "Garantía hasta",
      submit: "Registrar", empty: "Sin registros.",
    },
    claims: {
      title: "Reclamos de Calidad", newClaim: "Nuevo reclamo",
      sub: "Los defectos de calidad son nuestros — el remedio es reemplazo, condicionado a la devolución de la pieza (etiqueta prepagada).",
      reg: "Registro de garantía", defect: "Tipo de defecto", desc: "Descripción (contactos/enlaces bloqueados)",
      photos: "Fotos / video", submit: "Enviar reclamo", empty: "Sin reclamos.",
      types: { certMismatch: "Piedra ≠ certificado", setting: "Defecto de engaste", stoneLoss: "Pérdida de piedra (uso normal)", casting: "Defecto de fundición", plating: "Falla de baño" },
      st: { SUBMITTED: "Enviado", DENIED: "Denegado", AWAITING_RETURN: "Aprobado — esperando devolución", RETURN_RECEIVED: "Devolución recibida", REPLACED: "Reemplazo enviado" },
      returnNote: "Envía la pieza defectuosa al almacén de CA con la etiqueta prepagada.",
    },
    policies: {
      title: "Manual del Distribuidor",
      blocks: [
        ["MSRP & MAP", "El MSRP es sugerido, nunca obligatorio. La política MAP solo restringe precios anunciados — tu precio de venta siempre es tuyo. Anunciar bajo MAP puede terminar el suministro."],
        ["Devoluciones (recomendado)", "Piezas a medida: Venta Final, divulgada antes de la compra, defectos de calidad exceptuados. Catálogo estándar: 30 días con 20% de cargo por reposición, o cambio / crédito sin cargo."],
        ["Tallas", "Envía el medidor de anillos antes de confirmar el pedido. Los estilos no ajustables están marcados. El trabajo de terceros anula la garantía de engaste/metal — la de la piedra sobrevive."],
        ["Garantía", "Garantía de defectos de fabricación de 12 meses: defectos cosméticos dentro de 7 días, falla de engaste dentro de 12 meses. El mantenimiento por desgaste es servicio pagado."],
        ["Reclamos de calidad", "El comprador final solo te contacta a ti. Envía fotos/video; nosotros adjudicamos; el remedio es reemplazo condicionado a la devolución."],
        ["Divulgación FTC", "Toda descripción y anuncio debe indicar 'laboratory-grown'. Difuminar la línea natural/laboratorio es causa de terminación."],
      ],
    },
  },
  adminDealer: {
    menu: { dealers: "Distribuidores", catalog: "Catálogo Mayorista", wholesale: "Pedidos Mayoristas", claims: "Reclamos y Salvamento", warranty: "Registro de Garantías" },
    apps: { title: "Solicitudes", approve: "Aprobar", reject: "Rechazar", expected: "Esperado/trim", empty: "Sin solicitudes pendientes.", st: { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada" } },
    dealers: {
      title: "Distribuidores", tier: "Nivel", volume: "Vol. trimestral", cert: "Resale cert", certMissing: "falta",
      override: "Manual", none: "Auto", active: "Activo", suspended: "Suspendido", city: "Ciudad",
    },
    catalog: {
      title: "SKUs Mayoristas", goldSpot: "Oro ($/g)", applied: "Aplica de inmediato a pedidos nuevos.",
      msrp: "MSRP", t1: "Piedra T1", t2: "Piedra T2", grams: "Metal (g)", labor: "Mano de obra", resizable: "Ajustable",
      yes: "Sí", no: "No", newTitle: "Añadir SKU", name: "Nombre",
    },
    wholesale: {
      title: "Pedidos Mayoristas", dealer: "Distribuidor", attach: "Adjuntar fotos QC (requerido)",
      pass: "Aprobar QC", ship: "Enviar", deliver: "Marcar entregado", cancel: "Cancelar", trackingPh: "N.º de guía",
      shipToLbl: "Enviar a", spotAt: (s) => `Oro al ordenar: $${s}/g`,
    },
    claims: {
      title: "Adjudicación de Reclamos", approve: "Aprobar (reemplazo)", deny: "Denegar", note: "Nota",
      receive: "Recibir devolución", goldGrams: "Oro recuperado (g)", stonePool: "Piedra al inventario",
      credit: "Crédito de salvamento", replaced: "Reemplazo enviado",
      salvageTitle: "Libro de Salvamento", quarterTotal: (q, g, c) => `${q}: ${g}g recuperados · crédito ${c}`,
      photoEvidence: "Evidencia fotográfica",
    },
    warranty: { title: "Registro de Garantías", note: "Nosotros guardamos los datos; la relación con el cliente es del distribuidor. Sin marketing directo — contractual.", dealer: "Distribuidor" },
    settings: { tierThreshold: "Umbral trimestral Tier 1 ($)", goldSpot: "Oro ($/g)" },
  },
};

export const dealerStrings = { en, ko, zh, es };
