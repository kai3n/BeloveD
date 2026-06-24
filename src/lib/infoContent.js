// 신뢰·정책·회사소개(Tier 1) 콘텐츠 — 4개 언어.
// translations.js 비대화 방지 위해 분리. Info.jsx / Layout(Footer)에서 locale로 조회.

export const footerGroups = {
  en: { shop: "Shop", learn: "Learn", care: "Customer Care", company: "Company" },
  ko: { shop: "쇼핑", learn: "가이드", care: "고객 지원", company: "회사" },
  zh: { shop: "选购", learn: "了解", care: "客户服务", company: "公司" },
  es: { shop: "Tienda", learn: "Aprende", care: "Atención", company: "Compañía" },
};

export const infoNav = {
  en: { about: "About", returns: "Returns", warranty: "Warranty", shipping: "Shipping", contact: "Contact", faq: "FAQ", howItWorks: "How it works", labGrown: "Lab-grown diamonds", fourC: "The 4Cs" },
  ko: { about: "브랜드 소개", returns: "반품", warranty: "보증", shipping: "배송", contact: "문의", faq: "자주 묻는 질문", howItWorks: "주문 과정", labGrown: "랩그로운 다이아몬드", fourC: "4C 가이드" },
  zh: { about: "关于我们", returns: "退货", warranty: "保修", shipping: "配送", contact: "联系我们", faq: "常见问题", howItWorks: "定制流程", labGrown: "培育钻石", fourC: "4C 指南" },
  es: { about: "Sobre nosotros", returns: "Devoluciones", warranty: "Garantía", shipping: "Envíos", contact: "Contacto", faq: "Preguntas", howItWorks: "Cómo funciona", labGrown: "Diamantes de laboratorio", fourC: "Las 4C" },
};

export const trustStrip = {
  en: ["Free insured shipping", "30-day returns", "Lifetime warranty", "IGI & GIA certified"],
  ko: ["무료 보험 배송", "30일 반품", "평생 보증", "IGI·GIA 인증"],
  zh: ["免费保险配送", "30 天退货", "终身保修", "IGI·GIA 认证"],
  es: ["Envío asegurado gratis", "Devoluciones a 30 días", "Garantía de por vida", "Certificado IGI·GIA"],
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
      intro: "We want you to be certain. Bespoke pieces are made for you, so here is exactly how returns work.",
      sections: [
        { h: "30-day window", p: "Ready-to-ship loose diamonds and non-engraved designs may be returned within 30 days of delivery for a full refund — in original condition, with the certificate." },
        { h: "Bespoke & custom orders", p: "Made-to-order pieces are crafted to your specification and become final once production begins. Before that — during quote review and CAD approval — you may cancel for a full refund of any deposit." },
        { h: "How to start", p: "Open your order under Track your order, or contact customer care. We arrange free insured return shipping and confirm your refund within five business days of inspection." },
      ],
    },
    ko: {
      eyebrow: "고객 지원",
      title: ["반품 및", "교환."],
      intro: "확신을 드리고 싶습니다. 비스포크 피스는 당신을 위해 제작되므로, 반품이 어떻게 진행되는지 정확히 안내합니다.",
      sections: [
        { h: "30일 이내", p: "바로 출고되는 루스 다이아몬드와 각인 없는 디자인은 배송 후 30일 이내, 인증서와 함께 원래 상태로 반품 시 전액 환불됩니다." },
        { h: "비스포크·주문 제작", p: "주문 제작 피스는 사양에 맞춰 만들어지며 생산이 시작되면 확정됩니다. 그 전 — 견적 검토와 CAD 승인 단계 — 에는 디파짓 전액 환불로 취소할 수 있습니다." },
        { h: "신청 방법", p: "‘주문 조회’에서 주문을 열거나 고객 지원에 문의하세요. 무료 보험 반송을 준비해 드리며, 검수 후 5영업일 이내 환불을 확정합니다." },
      ],
    },
    zh: {
      eyebrow: "客户服务",
      title: ["退货与", "换货。"],
      intro: "我们希望你安心。定制作品是为你而制，以下是退货的具体方式。",
      sections: [
        { h: "30 天内", p: "现货裸钻与未刻字的设计，可在收货后 30 天内退货并全额退款 —— 须为原始状态并附证书。" },
        { h: "定制订单", p: "定制作品按你的规格制作，一旦投产即为最终。在此之前 —— 报价审核与 CAD 确认阶段 —— 你可取消并全额退还任何订金。" },
        { h: "如何申请", p: "在「订单查询」中打开订单，或联系客户服务。我们安排免费保险退运，并在验收后五个工作日内确认退款。" },
      ],
    },
    es: {
      eyebrow: "Atención al cliente",
      title: ["Devoluciones y", "cambios."],
      intro: "Queremos que tengas certeza. Las piezas a medida se hacen para ti, así que esto es exactamente cómo funcionan las devoluciones.",
      sections: [
        { h: "Ventana de 30 días", p: "Los diamantes sueltos en stock y los diseños sin grabado pueden devolverse dentro de 30 días tras la entrega con reembolso total — en condición original y con el certificado." },
        { h: "Pedidos a medida", p: "Las piezas a medida se elaboran según tu especificación y son finales una vez iniciada la producción. Antes — en revisión de cotización y aprobación del CAD — puedes cancelar con reembolso total del depósito." },
        { h: "Cómo iniciar", p: "Abre tu pedido en «Rastrea tu pedido» o contacta a atención al cliente. Gestionamos el envío de devolución asegurado y gratuito, y confirmamos tu reembolso en cinco días hábiles tras la inspección." },
      ],
    },
  },

  warranty: {
    en: {
      eyebrow: "Customer Care",
      title: ["Lifetime", "care."],
      intro: "Every Beloved piece is guaranteed for life against manufacturing defects, and looked after long after it leaves the atelier.",
      sections: [
        { h: "Lifetime manufacturing warranty", p: "We cover any defect in materials or craftsmanship — loose settings, broken prongs, manufacturing faults — for the life of the piece, at no charge." },
        { h: "Complimentary care", p: "Annual cleaning, polishing, and prong inspection are on us, and your first resize within 60 days is complimentary. We recommend a check every 6–12 months for everyday pieces." },
        { h: "What isn't covered", p: "General wear, loss, theft, or damage from accident or improper care. We recommend insuring your piece, and provide appraisal documentation for that purpose." },
      ],
    },
    ko: {
      eyebrow: "고객 지원",
      title: ["평생", "케어."],
      intro: "모든 Beloved 피스는 제조 결함에 대해 평생 보증되며, 아틀리에를 떠난 후에도 오래도록 관리받습니다.",
      sections: [
        { h: "평생 제조 보증", p: "소재나 세공의 결함 — 헐거운 세팅, 부러진 프롱, 제조 불량 — 을 피스의 일생 동안 무상으로 보증합니다." },
        { h: "무상 케어", p: "연 1회 클리닝·폴리싱·프롱 점검은 저희가 부담하며, 60일 이내 첫 리사이즈는 무상입니다. 데일리 피스는 6~12개월마다 점검을 권장합니다." },
        { h: "보증 제외", p: "일반 마모, 분실, 도난, 사고나 부적절한 관리로 인한 손상은 제외됩니다. 보험 가입을 권장하며, 이를 위한 감정 서류를 제공합니다." },
      ],
    },
    zh: {
      eyebrow: "客户服务",
      title: ["终身", "呵护。"],
      intro: "每一件 Beloved 作品都享有针对制造缺陷的终身保修，离开工坊后亦长久呵护。",
      sections: [
        { h: "终身制造保修", p: "材料或工艺的任何缺陷 —— 镶口松动、爪损、制造瑕疵 —— 在作品的一生中均免费保修。" },
        { h: "免费养护", p: "每年一次的清洁、抛光与爪位检查由我们承担，60 天内首次改圈免费。日常佩戴的作品建议每 6–12 个月检查一次。" },
        { h: "不在保修范围", p: "一般磨损、遗失、被盗，或因意外及不当养护造成的损坏。建议为作品投保，我们提供相应的估价文件。" },
      ],
    },
    es: {
      eyebrow: "Atención al cliente",
      title: ["Cuidado", "de por vida."],
      intro: "Cada pieza Beloved está garantizada de por vida contra defectos de fabricación, y se cuida mucho después de salir del atelier.",
      sections: [
        { h: "Garantía de fabricación de por vida", p: "Cubrimos cualquier defecto de material o factura — engastes flojos, garras rotas, fallas de fabricación — durante toda la vida de la pieza, sin costo." },
        { h: "Cuidado sin costo", p: "La limpieza, el pulido y la revisión de garras anuales corren por nuestra cuenta, y tu primer ajuste de talla dentro de 60 días es gratuito. Recomendamos una revisión cada 6–12 meses para piezas de diario." },
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
        { label: "Email", value: "care@beloved.example", note: "Replies within one business day" },
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
        { label: "이메일", value: "care@beloved.example", note: "1영업일 이내 회신" },
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
        { label: "邮箱", value: "care@beloved.example", note: "一个工作日内回复" },
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
        { label: "Email", value: "care@beloved.example", note: "Respuesta en un día hábil" },
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
        { q: "What if it doesn't fit?", a: "Your first resize within 60 days is complimentary. See Warranty and Returns for the details." },
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
        { q: "사이즈가 맞지 않으면요?", a: "60일 이내 첫 리사이즈는 무상입니다. 자세한 내용은 보증·반품을 참고하세요." },
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
        { q: "尺寸不合怎么办？", a: "60 天内首次改圈免费。详情请见保修与退货。" },
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
        { q: "¿Y si no me queda?", a: "Tu primer ajuste de talla dentro de 60 días es gratuito. Consulta Garantía y Devoluciones para los detalles." },
      ],
    },
  },
};
