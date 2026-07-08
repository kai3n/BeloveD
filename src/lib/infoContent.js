// 신뢰·정책·회사소개(Tier 1) 콘텐츠 — 4개 언어.
// translations.js 비대화 방지 위해 분리. Info.jsx / Layout(Footer)에서 locale로 조회.

// 소셜 프로필 — 핸들 변경 시 여기 한 곳만 수정 (Footer + Home Loved & Worn에서 참조)
export const social = {
  instagram: { handle: "@belovediamondjewelry", url: "https://www.instagram.com/belovediamondjewelry/" },
  facebook: { handle: "BeloveD Diamond", url: "https://www.facebook.com/profile.php?id=61563629707808" },
};

export const footerGroups = {
  en: { shop: "Shop", learn: "Learn", care: "Customer Care", company: "Company" },
  ko: { shop: "쇼핑", learn: "가이드", care: "고객 지원", company: "회사" },
  zh: { shop: "选购", learn: "了解", care: "客户服务", company: "公司" },
  es: { shop: "Tienda", learn: "Aprende", care: "Atención", company: "Compañía" },
};

export const infoNav = {
  en: { about: "About", returns: "Returns", warranty: "Warranty", shipping: "Shipping", contact: "Contact", faq: "FAQ", howItWorks: "How it works", labGrown: "Lab-grown diamonds", fourC: "The 4Cs", shapesGuide: "Diamond shapes", privacy: "Privacy policy" },
  ko: { about: "브랜드 소개", returns: "반품", warranty: "보증", shipping: "배송", contact: "문의", faq: "자주 묻는 질문", howItWorks: "주문 과정", labGrown: "랩그로운 다이아몬드", fourC: "4C 가이드", shapesGuide: "셰입 가이드", privacy: "개인정보처리방침" },
  zh: { about: "关于我们", returns: "退货", warranty: "保修", shipping: "配送", contact: "联系我们", faq: "常见问题", howItWorks: "定制流程", labGrown: "培育钻石", fourC: "4C 指南", shapesGuide: "形状指南", privacy: "隐私政策" },
  es: { about: "Sobre nosotros", returns: "Devoluciones", warranty: "Garantía", shipping: "Envíos", contact: "Contacto", faq: "Preguntas", howItWorks: "Cómo funciona", labGrown: "Diamantes de laboratorio", fourC: "Las 4C", shapesGuide: "Guía de formas", privacy: "Política de privacidad" },
};

export const trustStrip = {
  en: ["Free insured shipping", "Made to order for you", "Lifetime warranty", "IGI & GIA certified"],
  ko: ["무료 보험 배송", "1:1 주문 제작", "평생 보증", "IGI·GIA 인증"],
  zh: ["免费保险配送", "专属定制", "终身保修", "IGI·GIA 认证"],
  es: ["Envío asegurado gratis", "Hecho a medida para ti", "Garantía de por vida", "Certificado IGI·GIA"],
};

export const infoPages = {
  about: {
    en: {
      eyebrow: "The Maison",
      title: ["The atelier", "behind Beloved."],
      intro: "Beloved is a maison for the modern romantic — bespoke fine jewellery built on lab-grown diamonds, grown to order and priced without the retail markup.",
      sections: [
        { h: "Grown, not mined", p: "Every Beloved diamond is created in weeks in a laboratory — chemically, physically, and optically identical to a mined stone, certified by IGI or GIA, with none of the earth disturbed." },
        { h: "Made to order", p: "We hold no showroom inventory at retail prices. You choose the stone, the silhouette, and the metal; our artisans set each piece by hand. You only pay once you accept the quote." },
        { h: "Honest pricing", p: "By going direct — no mined-stone markup, no boutique overhead — a comparable diamond costs roughly half of traditional retail. The savings are the point, not a promotion." },
      ],
    },
    ko: {
      eyebrow: "메종",
      title: ["Beloved의", "아틀리에."],
      intro: "Beloved는 현대의 로맨티스트를 위한 메종입니다 — 랩그로운 다이아몬드 위에 짓는 비스포크 파인 주얼리, 주문대로 길러내고 리테일 마크업 없이 책정합니다.",
      sections: [
        { h: "캐낸 것이 아니라, 길러낸 빛", p: "모든 Beloved 다이아몬드는 실험실에서 수 주 만에 탄생합니다 — 천연석과 화학적·물리적·광학적으로 동일하며, IGI 또는 GIA 인증을 받고, 땅을 파헤치지 않습니다." },
        { h: "주문 제작", p: "리테일 가격의 쇼룸 재고를 두지 않습니다. 스톤·실루엣·메탈을 직접 고르면 장인이 하나하나 손으로 세팅합니다. 견적을 수락하기 전까지 결제는 없습니다." },
        { h: "정직한 가격", p: "직접 방식으로 — 채굴석 마크업도, 부티크 운영비도 없이 — 동급 다이아몬드를 전통 리테일의 약 절반 가격에 제공합니다. 절약은 프로모션이 아니라 본질입니다." },
      ],
    },
    zh: {
      eyebrow: "品牌",
      title: ["Beloved", "背后的工坊。"],
      intro: "Beloved 是为现代浪漫主义者打造的品牌 —— 以培育钻石为基础的高级定制珠宝，按需培育，没有零售溢价。",
      sections: [
        { h: "培育而非开采", p: "每一颗 Beloved 钻石都在实验室中数周内培育而成 —— 与天然钻石在化学、物理与光学上完全一致，经 IGI 或 GIA 认证，且不扰动大地。" },
        { h: "按需定制", p: "我们不持有零售价的展厅库存。你来选择主石、轮廓与金属，匠人逐件手工镶嵌。接受报价前无需付款。" },
        { h: "诚实定价", p: "通过直营 —— 没有天然石溢价，没有门店开销 —— 同级钻石约为传统零售的一半价格。省下的，正是核心，而非促销。" },
      ],
    },
    es: {
      eyebrow: "La Maison",
      title: ["El atelier", "tras Beloved."],
      intro: "Beloved es una maison para el romántico moderno — alta joyería a medida sobre diamantes de laboratorio, cultivados a tu pedido y sin el margen de la joyería.",
      sections: [
        { h: "Cultivado, no extraído", p: "Cada diamante Beloved se crea en semanas en laboratorio — idéntico en lo químico, físico y óptico a uno extraído, certificado por IGI o GIA, sin remover la tierra." },
        { h: "Hecho a medida", p: "No mantenemos inventario de exhibición a precio de tienda. Eliges la piedra, la silueta y el metal; nuestros artesanos engastan cada pieza a mano. Solo pagas al aceptar la cotización." },
        { h: "Precio honesto", p: "Al vender directo — sin margen de piedra extraída ni gastos de boutique — un diamante comparable cuesta cerca de la mitad del retail tradicional. El ahorro es el punto, no una promoción." },
      ],
    },
  },

  returns: {
    en: {
      eyebrow: "Customer Care",
      title: ["Returns &", "exchanges."],
      intro: "We want you to love your piece. Because every order is made to your specification, here is exactly how cancellations and returns work.",
      sections: [
        { h: "Custom & bespoke orders", p: "Every piece is made to your specification — the stone, the metal, the setting, the size. Because each order is yours alone, cancellations follow the production stages. Your deposit is 30% of the order total and is non-refundable at every stage." },
        { h: "Before CAD is issued", p: "You may cancel, but your deposit is not refunded." },
        { h: "After CAD is issued, before production begins", p: "You may cancel. Your deposit covers the design work already completed." },
        { h: "After production begins", p: "The piece is in active production for you. Your deposit covers the material and labor costs already incurred." },
        { h: "After delivery", p: "All custom pieces are final sale — no returns, no exchanges. If the finished piece does not match your approved CAD or specification, contact us and we will repair or replace it. See Warranty." },
        { h: "Ready-to-ship items", p: "Ready-to-ship items are final sale. We do not accept returns or exchanges on loose diamonds or non-custom designs." },
        { h: "Items we cannot accept", p: "Engraved or personalized pieces (unless the error is ours); items showing signs of wear, alteration, or third-party work; items returned without their original IGI certificate; custom pieces after delivery; gift cards and digital products." },
        { h: "Ring resizing", p: "Resizing is available on request. We provide a quote before any work begins — pricing depends on the design, metal, and number of sizes. Contact us through your order or at support@belovediamond.com." },
        { h: "Defective or incorrect items", p: "If your piece arrives with a manufacturing defect or does not match your approved specification, contact us immediately at support@belovediamond.com. We will assess the issue and repair or replace it — see Warranty." },
        { h: "International orders", p: "The same policy applies worldwide. Any duties or taxes paid at import are your responsibility to reclaim from your local customs authority should a return be authorized." },
      ],
      note: "If your situation doesn't fit neatly into one of these categories, write to us at support@belovediamond.com. We are small enough to treat every case personally.",
    },
    ko: {
      eyebrow: "고객 지원",
      title: ["반품 및", "교환."],
      intro: "당신이 피스를 사랑하게 되기를 바랍니다. 모든 주문은 고객님의 사양대로 제작되므로, 취소와 반품이 어떻게 진행되는지 정확히 안내합니다.",
      sections: [
        { h: "주문 제작(비스포크)", p: "모든 피스는 고객님의 사양 — 스톤, 메탈, 세팅, 사이즈 — 대로 제작됩니다. 오직 당신만을 위한 주문이기에, 취소는 제작 단계를 따릅니다. 디파짓은 주문 총액의 30%이며 어느 단계에서도 환불되지 않습니다." },
        { h: "CAD 발행 전", p: "취소하실 수 있지만, 디파짓은 환불되지 않습니다." },
        { h: "CAD 발행 후, 제작 시작 전", p: "취소하실 수 있습니다. 디파짓은 이미 완료된 디자인 작업 비용을 충당합니다." },
        { h: "제작 시작 후", p: "피스가 고객님을 위해 한창 제작되는 중입니다. 디파짓은 이미 투입된 자재비와 공임을 충당합니다." },
        { h: "배송 후", p: "모든 주문 제작 피스는 최종 판매입니다 — 반품·교환이 불가합니다. 완성품이 승인하신 CAD나 사양과 다르다면 연락 주세요. 수리 또는 교체해 드립니다. 보증 페이지를 참고하세요." },
        { h: "즉시 출고 상품", p: "즉시 출고 상품은 최종 판매입니다. 루스 다이아몬드와 비맞춤 디자인은 반품·교환을 받지 않습니다." },
        { h: "반품이 불가한 경우", p: "각인·개인화된 피스(저희 실수 제외), 착용·변형·타사 세공 흔적이 있는 피스, 원본 IGI 인증서가 없는 반품, 배송 후의 주문 제작 피스, 기프트 카드·디지털 상품." },
        { h: "링 리사이즈", p: "리사이즈는 요청 시 진행됩니다. 작업 전에 먼저 견적을 안내드려요 — 비용은 디자인, 메탈, 조정 사이즈 수에 따라 달라집니다. 주문 페이지 또는 support@belovediamond.com으로 문의하세요." },
        { h: "결함·오배송", p: "제조 결함이 있거나 승인하신 사양과 다른 피스가 도착했다면 support@belovediamond.com으로 바로 연락 주세요. 확인 후 수리 또는 교체해 드립니다 — 보증 페이지를 참고하세요." },
        { h: "해외 주문", p: "전 세계 동일한 정책이 적용됩니다. 반품이 승인된 경우, 수입 시 납부한 관세·세금은 현지 세관에 직접 환급을 신청하셔야 합니다." },
      ],
      note: "어느 항목에도 딱 맞지 않는 상황이라면 support@belovediamond.com으로 편하게 적어 보내주세요. 모든 사례를 직접 살필 수 있을 만큼 작은 팀입니다.",
    },
    zh: {
      eyebrow: "客户服务",
      title: ["退货与", "换货。"],
      intro: "我们希望你爱上你的作品。每一件都按你的规格定制，以下是取消与退货的具体规则。",
      sections: [
        { h: "定制订单", p: "每一件作品都按你的规格制作 —— 主石、金属、镶嵌、尺寸。正因为每件都只属于你，取消依制作阶段而定。订金为订单总额的 30%，在任何阶段均不退还。" },
        { h: "CAD 出图前", p: "可以取消，但订金不予退还。" },
        { h: "CAD 出图后、投产前", p: "可以取消。订金用于抵付已完成的设计工作。" },
        { h: "投产后", p: "作品正在为你制作中。订金用于抵付已投入的材料与工费。" },
        { h: "交付后", p: "所有定制作品均为最终销售 —— 不退不换。若成品与你确认的 CAD 或规格不符，请联系我们，我们将修复或更换。详见保修。" },
        { h: "现货商品", p: "现货商品为最终销售。裸钻与非定制设计不接受退换。" },
        { h: "不予受理的情况", p: "刻字或个性化作品（我方失误除外）；有佩戴、改动或第三方加工痕迹的物品；未附原始 IGI 证书的退货；交付后的定制作品；礼品卡与数字商品。" },
        { h: "戒指改圈", p: "改圈可按需申请。动工前我们会先报价 —— 费用视设计、金属与调整圈数而定。请通过订单页面或 support@belovediamond.com 联系我们。" },
        { h: "瑕疵或错发", p: "若作品存在制造缺陷或与你确认的规格不符，请立即联系 support@belovediamond.com。我们将评估并修复或更换 —— 详见保修。" },
        { h: "国际订单", p: "全球适用同一政策。若退货获批，进口时缴纳的关税与税费需由你向当地海关申请退还。" },
      ],
      note: "如果你的情况不完全属于以上任一类别，请写信至 support@belovediamond.com。我们的团队足够小，能亲自照看每一个案例。",
    },
    es: {
      eyebrow: "Atención al cliente",
      title: ["Devoluciones y", "cambios."],
      intro: "Queremos que ames tu pieza. Como cada pedido se hace según tu especificación, esto es exactamente cómo funcionan las cancelaciones y devoluciones.",
      sections: [
        { h: "Pedidos a medida", p: "Cada pieza se hace según tu especificación — la piedra, el metal, el engaste, la talla. Como cada pedido es solo tuyo, las cancelaciones siguen las etapas de producción. El depósito es el 30% del total del pedido y no es reembolsable en ninguna etapa." },
        { h: "Antes de emitir el CAD", p: "Puedes cancelar, pero el depósito no se reembolsa." },
        { h: "Tras emitir el CAD, antes de producción", p: "Puedes cancelar. El depósito cubre el trabajo de diseño ya realizado." },
        { h: "Tras iniciar la producción", p: "La pieza está en producción activa para ti. El depósito cubre los costos de material y mano de obra ya incurridos." },
        { h: "Tras la entrega", p: "Todas las piezas a medida son venta final — sin devoluciones ni cambios. Si la pieza terminada no coincide con el CAD o la especificación aprobada, contáctanos y la repararemos o reemplazaremos. Ver Garantía." },
        { h: "Artículos listos para enviar", p: "Los artículos listos para enviar son venta final. No aceptamos devoluciones ni cambios de diamantes sueltos o diseños no personalizados." },
        { h: "Artículos que no podemos aceptar", p: "Piezas grabadas o personalizadas (salvo error nuestro); artículos con señales de uso, alteración o trabajo de terceros; devoluciones sin su certificado IGI original; piezas a medida tras la entrega; tarjetas de regalo y productos digitales." },
        { h: "Ajuste de talla", p: "El ajuste de talla está disponible bajo pedido. Cotizamos antes de empezar cualquier trabajo — el precio depende del diseño, el metal y el número de tallas. Contáctanos desde tu pedido o en support@belovediamond.com." },
        { h: "Artículos defectuosos o incorrectos", p: "Si tu pieza llega con un defecto de fabricación o no coincide con la especificación aprobada, escríbenos de inmediato a support@belovediamond.com. Evaluaremos el caso y la repararemos o reemplazaremos — ver Garantía." },
        { h: "Pedidos internacionales", p: "La misma política aplica en todo el mundo. Si se autoriza una devolución, los aranceles o impuestos pagados en la importación deben reclamarse ante tu aduana local." },
      ],
      note: "Si tu situación no encaja del todo en una de estas categorías, escríbenos a support@belovediamond.com. Somos lo bastante pequeños para tratar cada caso personalmente.",
    },
  },

  warranty: {
    en: {
      eyebrow: "Customer Care",
      title: ["Lifetime", "care."],
      intro: "Every Beloved piece is guaranteed for life against manufacturing defects, and looked after long after it leaves the atelier.",
      sections: [
        { h: "Lifetime manufacturing warranty", p: "We cover any defect in materials or craftsmanship — loose settings, broken prongs, manufacturing faults — for the life of the piece, at no charge." },
        { h: "Complimentary care", p: "Annual cleaning, polishing, and prong inspection are on us. Resizing is available on request — we provide a quote before any work begins. We recommend a check every 6–12 months for everyday pieces." },
        { h: "What isn't covered", p: "General wear, loss, theft, or damage from accident or improper care. We recommend insuring your piece, and provide appraisal documentation for that purpose." },
      ],
    },
    ko: {
      eyebrow: "고객 지원",
      title: ["평생", "케어."],
      intro: "모든 Beloved 피스는 제조 결함에 대해 평생 보증되며, 아틀리에를 떠난 후에도 오래도록 관리받습니다.",
      sections: [
        { h: "평생 제조 보증", p: "소재나 세공의 결함 — 헐거운 세팅, 부러진 프롱, 제조 불량 — 을 피스의 일생 동안 무상으로 보증합니다." },
        { h: "무상 케어", p: "연 1회 클리닝·폴리싱·프롱 점검은 저희가 부담합니다. 리사이즈는 요청 시 진행되며, 작업 전에 먼저 견적을 안내드립니다. 데일리 피스는 6~12개월마다 점검을 권장합니다." },
        { h: "보증 제외", p: "일반 마모, 분실, 도난, 사고나 부적절한 관리로 인한 손상은 제외됩니다. 보험 가입을 권장하며, 이를 위한 감정 서류를 제공합니다." },
      ],
    },
    zh: {
      eyebrow: "客户服务",
      title: ["终身", "呵护。"],
      intro: "每一件 Beloved 作品都享有针对制造缺陷的终身保修，离开工坊后亦长久呵护。",
      sections: [
        { h: "终身制造保修", p: "材料或工艺的任何缺陷 —— 镶口松动、爪损、制造瑕疵 —— 在作品的一生中均免费保修。" },
        { h: "免费养护", p: "每年一次的清洁、抛光与爪位检查由我们承担。改圈可按需申请，动工前先行报价。日常佩戴的作品建议每 6–12 个月检查一次。" },
        { h: "不在保修范围", p: "一般磨损、遗失、被盗，或因意外及不当养护造成的损坏。建议为作品投保，我们提供相应的估价文件。" },
      ],
    },
    es: {
      eyebrow: "Atención al cliente",
      title: ["Cuidado", "de por vida."],
      intro: "Cada pieza Beloved está garantizada de por vida contra defectos de fabricación, y se cuida mucho después de salir del atelier.",
      sections: [
        { h: "Garantía de fabricación de por vida", p: "Cubrimos cualquier defecto de material o factura — engastes flojos, garras rotas, fallas de fabricación — durante toda la vida de la pieza, sin costo." },
        { h: "Cuidado sin costo", p: "La limpieza, el pulido y la revisión de garras anuales corren por nuestra cuenta. El ajuste de talla está disponible bajo pedido — cotizamos antes de empezar cualquier trabajo. Recomendamos una revisión cada 6–12 meses para piezas de diario." },
        { h: "Lo que no cubre", p: "Desgaste general, pérdida, robo o daño por accidente o cuidado inadecuado. Recomendamos asegurar tu pieza y entregamos documentación de avalúo para ello." },
      ],
    },
  },

  shipping: {
    en: {
      eyebrow: "Customer Care",
      title: ["Shipping &", "delivery."],
      intro: "Free, fully insured, signature-required delivery on every order — discreetly packaged.",
      sections: [
        { h: "Free insured shipping", p: "All orders ship free, fully insured, with a signature required on delivery. Tracking is shared the moment your piece leaves the atelier." },
        { h: "Production lead times", p: "Loose diamonds typically ship in 2–4 business days. Bespoke pieces take 3–5 weeks depending on design and setting; your exact timeline is confirmed with the quote." },
        { h: "Discreet & worldwide", p: "Pieces arrive in unbranded, secure packaging — with the Beloved presentation box inside. We ship worldwide; duties, where applicable, are shown at checkout or quote." },
      ],
    },
    ko: {
      eyebrow: "고객 지원",
      title: ["배송 및", "수령."],
      intro: "모든 주문에 무료·완전 보험·서명 수령 배송 — 눈에 띄지 않는 포장으로 보내드립니다.",
      sections: [
        { h: "무료 보험 배송", p: "모든 주문은 무료로, 완전 보험과 함께, 수령 시 서명을 받아 배송됩니다. 피스가 아틀리에를 떠나는 즉시 추적 정보를 공유합니다." },
        { h: "제작 소요 기간", p: "루스 다이아몬드는 보통 2~4영업일 내 출고됩니다. 비스포크 피스는 디자인과 세팅에 따라 3~5주가 소요되며, 정확한 일정은 견적과 함께 확정됩니다." },
        { h: "비노출·전 세계 배송", p: "피스는 브랜드 표시가 없는 안전 포장으로 도착하며, 그 안에 Beloved 프레젠테이션 박스가 담깁니다. 전 세계 배송하며, 해당 시 관세는 결제 또는 견적 단계에서 안내됩니다." },
      ],
    },
    zh: {
      eyebrow: "客户服务",
      title: ["配送与", "送达。"],
      intro: "每笔订单均免费、全额保险、需签收送达 —— 低调包装。",
      sections: [
        { h: "免费保险配送", p: "所有订单免费寄送，全额保险，送达需签收。作品离开工坊的那一刻即共享物流追踪。" },
        { h: "制作周期", p: "裸钻通常 2–4 个工作日发货。定制作品视设计与镶嵌需 3–5 周；确切时间会随报价确认。" },
        { h: "低调·全球配送", p: "作品以无品牌标识的安全包装送达 —— 内含 Beloved 礼盒。我们全球配送；如涉及关税，将在结算或报价时显示。" },
      ],
    },
    es: {
      eyebrow: "Atención al cliente",
      title: ["Envíos y", "entrega."],
      intro: "Entrega gratuita, totalmente asegurada y con firma en cada pedido — en empaque discreto.",
      sections: [
        { h: "Envío asegurado gratis", p: "Todos los pedidos se envían gratis, con seguro total y firma a la entrega. El rastreo se comparte en cuanto tu pieza sale del atelier." },
        { h: "Tiempos de producción", p: "Los diamantes sueltos suelen enviarse en 2–4 días hábiles. Las piezas a medida tardan 3–5 semanas según diseño y engaste; tu plazo exacto se confirma con la cotización." },
        { h: "Discreto y mundial", p: "Las piezas llegan en empaque seguro sin marca — con la caja de presentación Beloved dentro. Enviamos a todo el mundo; los aranceles, cuando aplican, se muestran al pagar o cotizar." },
      ],
    },
  },

  contact: {
    en: {
      eyebrow: "Customer Care",
      title: ["Talk to a", "diamond expert."],
      intro: "Real people, not chatbots. Reach a client advisor for anything — a quote, a question, or guidance through your first bespoke piece.",
      channels: [
        { label: "Email", value: "support@belovediamond.com", note: "Replies within one business day" },
        { label: "Hours", value: "Mon–Sat · 9:00–18:00 PT" },
        { label: "Begin a piece", value: "Start a custom order", to: "/custom/new" },
        { label: "Existing order", value: "Track your order", to: "/track" },
      ],
      note: "For your privacy, messaging on an active order is handled inside your secure order workspace.",
    },
    ko: {
      eyebrow: "고객 지원",
      title: ["다이아몬드 전문가와", "상담하세요."],
      intro: "챗봇이 아닌 실제 어드바이저입니다. 견적, 질문, 첫 비스포크 안내까지 무엇이든 도와드립니다.",
      channels: [
        { label: "이메일", value: "support@belovediamond.com", note: "1영업일 이내 회신" },
        { label: "운영 시간", value: "월–토 · 9:00–18:00 (PT)" },
        { label: "피스 시작", value: "주문 제작 시작", to: "/custom/new" },
        { label: "기존 주문", value: "주문 조회", to: "/track" },
      ],
      note: "개인정보 보호를 위해, 진행 중인 주문의 메시지는 보안 주문 워크스페이스 안에서 처리됩니다.",
    },
    zh: {
      eyebrow: "客户服务",
      title: ["与钻石专家", "对话。"],
      intro: "真人顾问，而非聊天机器人。报价、疑问，或第一件定制的引导 —— 任何事都可咨询。",
      channels: [
        { label: "邮箱", value: "support@belovediamond.com", note: "一个工作日内回复" },
        { label: "服务时间", value: "周一至周六 · 9:00–18:00（PT）" },
        { label: "开始定制", value: "开始定制订单", to: "/custom/new" },
        { label: "已有订单", value: "订单查询", to: "/track" },
      ],
      note: "为保护隐私，进行中订单的沟通在你的安全订单工作区内处理。",
    },
    es: {
      eyebrow: "Atención al cliente",
      title: ["Habla con un", "experto en diamantes."],
      intro: "Personas reales, no chatbots. Contacta a un asesor para lo que sea — una cotización, una duda o guía en tu primera pieza a medida.",
      channels: [
        { label: "Email", value: "support@belovediamond.com", note: "Respuesta en un día hábil" },
        { label: "Horario", value: "Lun–Sáb · 9:00–18:00 PT" },
        { label: "Crear una pieza", value: "Iniciar pedido a medida", to: "/custom/new" },
        { label: "Pedido existente", value: "Rastrea tu pedido", to: "/track" },
      ],
      note: "Por tu privacidad, los mensajes de un pedido activo se gestionan dentro de tu espacio de pedido seguro.",
    },
  },

  faq: {
    en: {
      eyebrow: "Answers",
      title: ["Frequently", "asked."],
      intro: "The essentials. For anything else, a client advisor is a message away.",
      faq: [
        { q: "Are lab-grown diamonds real diamonds?", a: "Yes — chemically, physically, and optically identical to mined diamonds. The only difference is origin: grown in weeks in a lab, not over a billion years underground. Both are graded by the same labs, IGI and GIA." },
        { q: "Why are they about half the price?", a: "No mining, no multi-tier supply chain, and we sell direct. A comparable lab-grown stone runs roughly 50% less than a mined equivalent of the same grade." },
        { q: "Will it test as a real diamond?", a: "Yes. A standard diamond tester reads it as diamond, because it is one. Certificates simply note it as laboratory-grown." },
        { q: "How does a custom order work?", a: "Choose a silhouette and a stone, or upload references. We return a quote and CAD renders for your approval. Nothing is charged until you accept, and production begins only after you sign off." },
        { q: "What if it doesn't fit?", a: "Resizing is available on request — we provide a quote before any work begins, based on the design, metal, and number of sizes. Contact us through your order or at support@belovediamond.com." },
      ],
    },
    ko: {
      eyebrow: "답변",
      title: ["자주 묻는", "질문."],
      intro: "핵심만 모았습니다. 그 외 무엇이든 어드바이저에게 메시지 한 통이면 됩니다.",
      faq: [
        { q: "랩그로운 다이아몬드도 진짜 다이아몬드인가요?", a: "네 — 채굴 다이아몬드와 화학적·물리적·광학적으로 동일합니다. 차이는 오직 기원입니다: 땅속 10억 년이 아니라 실험실에서 수 주 만에 자랍니다. 둘 다 같은 기관(IGI·GIA)에서 등급을 받습니다." },
        { q: "왜 가격이 약 절반인가요?", a: "채굴도, 다단계 유통도 없고, 저희는 직접 판매합니다. 동급 채굴석 대비 비슷한 랩그로운 스톤이 약 50% 저렴합니다." },
        { q: "다이아몬드 테스터에 진짜로 나오나요?", a: "네. 일반 다이아몬드 테스터가 다이아몬드로 인식합니다 — 실제로 다이아몬드이기 때문입니다. 인증서에는 랩그로운으로 표기됩니다." },
        { q: "주문 제작은 어떻게 진행되나요?", a: "실루엣과 스톤을 고르거나 레퍼런스를 올려주세요. 견적과 CAD 렌더를 보내 승인받습니다. 수락 전까지 결제는 없으며, 사인오프 후에만 생산이 시작됩니다." },
        { q: "사이즈가 맞지 않으면요?", a: "리사이즈는 요청 시 진행됩니다 — 디자인·메탈·조정 사이즈 수에 따라, 작업 전에 먼저 견적을 안내드려요. 주문 페이지나 support@belovediamond.com으로 문의하세요." },
      ],
    },
    zh: {
      eyebrow: "解答",
      title: ["常见", "问题。"],
      intro: "只列要点。其余任何问题，向顾问发条消息即可。",
      faq: [
        { q: "培育钻石是真钻石吗？", a: "是的 —— 与开采钻石在化学、物理与光学上完全一致。唯一区别在于来源：在实验室中数周培育，而非地下十亿年。两者由相同机构（IGI、GIA）分级。" },
        { q: "为什么价格约为一半？", a: "没有开采，没有多层供应链，且我们直营。同级别下，相当的培育钻石比开采钻石约便宜 50%。" },
        { q: "测钻笔会显示为真钻吗？", a: "会。标准测钻笔会识别为钻石 —— 因为它就是钻石。证书会注明为实验室培育。" },
        { q: "定制流程是怎样的？", a: "选择轮廓与主石，或上传参考。我们提供报价与 CAD 渲染供你确认。接受前不收费，确认后才开始制作。" },
        { q: "尺寸不合怎么办？", a: "改圈可按需申请 —— 依设计、金属与调整圈数，动工前先行报价。请通过订单页面或 support@belovediamond.com 联系我们。" },
      ],
    },
    es: {
      eyebrow: "Respuestas",
      title: ["Preguntas", "frecuentes."],
      intro: "Lo esencial. Para cualquier otra cosa, un asesor está a un mensaje de distancia.",
      faq: [
        { q: "¿Los diamantes de laboratorio son diamantes reales?", a: "Sí — idénticos en lo químico, físico y óptico a los extraídos. La única diferencia es el origen: cultivados en semanas en laboratorio, no en mil millones de años bajo tierra. Ambos los gradúan los mismos laboratorios, IGI y GIA." },
        { q: "¿Por qué cuestan cerca de la mitad?", a: "Sin minería, sin cadena de suministro de varios niveles, y vendemos directo. Una piedra de laboratorio comparable cuesta cerca de 50% menos que una extraída del mismo grado." },
        { q: "¿Pasará la prueba de diamante?", a: "Sí. Un probador estándar la lee como diamante, porque lo es. El certificado simplemente la indica como cultivada en laboratorio." },
        { q: "¿Cómo funciona un pedido a medida?", a: "Elige una silueta y una piedra, o sube referencias. Devolvemos una cotización y renders CAD para tu aprobación. No se cobra nada hasta que aceptas, y la producción empieza solo tras tu visto bueno." },
        { q: "¿Y si no me queda?", a: "El ajuste de talla está disponible bajo pedido — cotizamos antes de empezar, según el diseño, el metal y el número de tallas. Contáctanos desde tu pedido o en support@belovediamond.com." },
      ],
    },
  },

  // 개인정보처리방침 — Pinterest 등 광고/소셜 계정 등록에 독립 URL(/privacy)이 요구된다.
  // 내용은 실제 동작 기준: 인테이크 연락처·레퍼런스 미디어·bd_aid 활동 분석·localStorage,
  // 카드 미수집(Zelle/Venmo 외부 처리), 제작 파트너에는 연락처 마스킹 후 사양만 전달.
  privacy: {
    en: {
      eyebrow: "Legal",
      title: ["Privacy", "policy."],
      intro: "Effective July 7, 2026. This policy explains what personal data BeloveD (belovediamond.com) collects, how we use it, and the choices you have.",
      sections: [
        { h: "What we collect", p: "When you request a quote or place an order we collect your name, email address or phone number, jewelry specifications (including engraving text and coupon codes), preferred dates, and any reference photos or videos you upload. If you create an account, we store your email for one-time-code sign-in. When you leave a review, we store its text and media." },
        { h: "Collected automatically", p: "We assign a random visitor identifier (bd_aid) and log page views and interactions such as wizard selections to understand how the site is used. Our servers also record IP addresses and browser information for security and rate limiting." },
        { h: "How we use it", p: "To prepare quotes and proposals, craft and deliver your order, send transactional emails (order confirmations, sign-in codes, status updates), provide customer care, prevent abuse, and improve the site. We do not send marketing email without your consent." },
        { h: "Payments", p: "We never collect or store card numbers. Payments are arranged through external channels such as Zelle or Venmo, and are governed by those providers' terms." },
        { h: "Sharing", p: "We never sell your personal data. Manufacturing partners receive only jewelry specifications and reference images — contact details are masked before anything is shared. Infrastructure processors act on our instructions: Vercel (hosting), Neon (database), Cloudflare (media storage), and Resend (email delivery)." },
        { h: "Where data lives & retention", p: "Data is stored on servers located in the United States. Order records are kept as long as needed to fulfill your order and meet legal obligations; you may request deletion of data we are not required to keep." },
        { h: "Cookies & local storage", p: "We use browser local storage — not advertising cookies — for your theme preference, in-progress order drafts, sign-in session, and the bd_aid analytics identifier. Clearing your browser storage removes them." },
        { h: "Your rights", p: "You may request access to, correction of, or deletion of your personal data at any time by emailing us. We respond within a reasonable period, and applicable local rights (such as GDPR or CCPA rights) are honored." },
        { h: "Children", p: "Our services are not directed to children under 13, and we do not knowingly collect their data." },
        { h: "Changes", p: "If this policy changes materially, we will update this page and revise the effective date above." },
      ],
      channels: [
        { label: "Privacy inquiries", value: "support@belovediamond.com", note: "Replies within one business day" },
      ],
    },
    ko: {
      eyebrow: "법적 고지",
      title: ["개인정보", "처리방침."],
      intro: "시행일 2026년 7월 7일. 이 방침은 BeloveD(belovediamond.com)가 어떤 개인정보를 수집하고, 어떻게 이용하며, 어떤 선택권이 있는지 설명합니다.",
      sections: [
        { h: "수집하는 정보", p: "견적 요청·주문 시 이름, 이메일 또는 연락처, 주얼리 사양(각인 문구·쿠폰 코드 포함), 희망일, 업로드하신 레퍼런스 사진·영상을 수집합니다. 계정을 만들면 일회용 코드 로그인을 위한 이메일을 저장하며, 리뷰 작성 시 리뷰 내용과 미디어를 저장합니다." },
        { h: "자동으로 수집되는 정보", p: "사이트 이용 방식을 파악하기 위해 무작위 방문자 식별자(bd_aid)를 부여하고 페이지 열람·위저드 선택 등의 이벤트를 기록합니다. 서버는 보안과 요청 제한을 위해 IP 주소와 브라우저 정보를 기록합니다." },
        { h: "이용 목적", p: "견적·제안 준비, 주문 제작·배송, 거래 이메일 발송(접수 확인·로그인 코드·진행 알림), 고객 지원, 부정 사용 방지, 사이트 개선에 이용합니다. 동의 없이 마케팅 이메일을 보내지 않습니다." },
        { h: "결제 정보", p: "카드 번호를 수집하거나 저장하지 않습니다. 결제는 Zelle·Venmo 등 외부 채널로 진행되며 해당 서비스의 약관이 적용됩니다." },
        { h: "제3자 제공", p: "개인정보를 판매하지 않습니다. 제작 파트너에게는 연락처를 가린 뒤 주얼리 사양과 레퍼런스 이미지만 전달합니다. 인프라 처리자는 저희 지시에 따라 작동합니다: Vercel(호스팅), Neon(데이터베이스), Cloudflare(미디어 저장), Resend(이메일 발송)." },
        { h: "보관 위치와 기간", p: "데이터는 미국 소재 서버에 저장됩니다. 주문 기록은 주문 이행과 법적 의무에 필요한 기간 동안 보관하며, 보관 의무가 없는 데이터는 삭제를 요청하실 수 있습니다." },
        { h: "쿠키·로컬 저장소", p: "광고 쿠키가 아닌 브라우저 로컬 저장소를 사용합니다 — 테마 설정, 작성 중인 주문 드래프트, 로그인 세션, bd_aid 분석 식별자가 여기에 해당합니다. 브라우저 저장소를 지우면 함께 삭제됩니다." },
        { h: "이용자의 권리", p: "언제든 이메일로 본인 개인정보의 열람·정정·삭제를 요청할 수 있습니다. 합리적인 기간 내에 회신하며, GDPR·CCPA 등 관련 지역 법령상의 권리를 존중합니다." },
        { h: "아동", p: "저희 서비스는 만 13세 미만 아동을 대상으로 하지 않으며, 아동의 정보를 고의로 수집하지 않습니다." },
        { h: "변경 고지", p: "방침이 중요하게 바뀌면 이 페이지를 갱신하고 상단의 시행일을 수정합니다." },
      ],
      channels: [
        { label: "개인정보 문의", value: "support@belovediamond.com", note: "1영업일 이내 회신" },
      ],
    },
    zh: {
      eyebrow: "法律条款",
      title: ["隐私", "政策。"],
      intro: "生效日期：2026 年 7 月 7 日。本政策说明 BeloveD（belovediamond.com）收集哪些个人数据、如何使用，以及你拥有的选择。",
      sections: [
        { h: "我们收集的信息", p: "当你询价或下单时，我们收集你的姓名、邮箱或电话、珠宝规格（含刻字内容与优惠码）、期望日期，以及你上传的参考照片或视频。若你创建账户，我们存储用于一次性验证码登录的邮箱；发表评价时，我们存储评价内容与媒体。" },
        { h: "自动收集的信息", p: "为了解网站使用情况，我们分配随机访客标识（bd_aid）并记录页面浏览与向导选择等事件。服务器还会出于安全与限流目的记录 IP 地址与浏览器信息。" },
        { h: "使用目的", p: "用于准备报价与方案、制作并交付订单、发送交易邮件（下单确认、登录验证码、进度通知）、客户服务、防止滥用及改进网站。未经你的同意，我们不会发送营销邮件。" },
        { h: "支付信息", p: "我们从不收集或存储银行卡号。付款通过 Zelle、Venmo 等外部渠道进行，并受相应服务条款约束。" },
        { h: "第三方共享", p: "我们从不出售你的个人数据。制作合作方仅收到珠宝规格与参考图片 —— 共享前会先隐去联系方式。基础设施处理方按我们的指示运作：Vercel（托管）、Neon（数据库）、Cloudflare（媒体存储）、Resend（邮件发送）。" },
        { h: "存储位置与期限", p: "数据存储在位于美国的服务器上。订单记录在履行订单与满足法律义务所需期间内保留；对无保留义务的数据，你可以申请删除。" },
        { h: "Cookie 与本地存储", p: "我们使用浏览器本地存储而非广告 Cookie —— 包括主题偏好、进行中的订单草稿、登录会话与 bd_aid 分析标识。清除浏览器存储即会删除它们。" },
        { h: "你的权利", p: "你可随时通过邮件申请查阅、更正或删除你的个人数据。我们会在合理期限内回复，并尊重 GDPR、CCPA 等适用地区法规赋予的权利。" },
        { h: "儿童", p: "我们的服务不面向 13 岁以下儿童，也不会有意收集其数据。" },
        { h: "政策变更", p: "若本政策发生重大变化，我们会更新本页面并修改上方的生效日期。" },
      ],
      channels: [
        { label: "隐私咨询", value: "support@belovediamond.com", note: "一个工作日内回复" },
      ],
    },
    es: {
      eyebrow: "Legal",
      title: ["Política de", "privacidad."],
      intro: "Vigente desde el 7 de julio de 2026. Esta política explica qué datos personales recopila BeloveD (belovediamond.com), cómo los usamos y qué opciones tienes.",
      sections: [
        { h: "Qué recopilamos", p: "Cuando solicitas una cotización o haces un pedido recopilamos tu nombre, correo o teléfono, las especificaciones de la joya (incluido el texto de grabado y códigos de cupón), fechas preferidas y las fotos o videos de referencia que subas. Si creas una cuenta, guardamos tu correo para el inicio de sesión con código de un solo uso. Al dejar una reseña, guardamos su texto y medios." },
        { h: "Recopilado automáticamente", p: "Asignamos un identificador aleatorio de visitante (bd_aid) y registramos vistas de página e interacciones, como selecciones del asistente, para entender el uso del sitio. Nuestros servidores también registran direcciones IP e información del navegador por seguridad y límites de peticiones." },
        { h: "Cómo lo usamos", p: "Para preparar cotizaciones y propuestas, elaborar y entregar tu pedido, enviar correos transaccionales (confirmaciones, códigos de acceso, avisos de estado), dar atención al cliente, prevenir abusos y mejorar el sitio. No enviamos correos de marketing sin tu consentimiento." },
        { h: "Pagos", p: "Nunca recopilamos ni almacenamos números de tarjeta. Los pagos se gestionan por canales externos como Zelle o Venmo, sujetos a los términos de esos proveedores." },
        { h: "Compartición", p: "Nunca vendemos tus datos personales. Los talleres asociados reciben solo especificaciones e imágenes de referencia — los datos de contacto se enmascaran antes de compartir nada. Los procesadores de infraestructura actúan bajo nuestras instrucciones: Vercel (alojamiento), Neon (base de datos), Cloudflare (almacenamiento de medios) y Resend (envío de correo)." },
        { h: "Dónde residen los datos y retención", p: "Los datos se almacenan en servidores ubicados en Estados Unidos. Los registros de pedidos se conservan el tiempo necesario para cumplir tu pedido y las obligaciones legales; puedes solicitar la eliminación de los datos que no estemos obligados a conservar." },
        { h: "Cookies y almacenamiento local", p: "Usamos el almacenamiento local del navegador — no cookies publicitarias — para tu preferencia de tema, borradores de pedido en curso, la sesión de acceso y el identificador analítico bd_aid. Al limpiar el almacenamiento del navegador se eliminan." },
        { h: "Tus derechos", p: "Puedes solicitar en cualquier momento el acceso, la corrección o la eliminación de tus datos personales por correo. Respondemos en un plazo razonable y respetamos los derechos locales aplicables (como los del RGPD o la CCPA)." },
        { h: "Menores", p: "Nuestros servicios no están dirigidos a menores de 13 años y no recopilamos sus datos a sabiendas." },
        { h: "Cambios", p: "Si esta política cambia de forma sustancial, actualizaremos esta página y revisaremos la fecha de vigencia indicada arriba." },
      ],
      channels: [
        { label: "Consultas de privacidad", value: "support@belovediamond.com", note: "Respuesta en un día hábil" },
      ],
    },
  },
};
