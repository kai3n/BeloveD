export const orders = [
  {
    code: "BD-260714-08", title: "六爪经典订婚戒", category: "戒指", stage: "制作中", stageKey: "production",
    due: "7月18日", dueTone: "urgent", updated: "12分钟前", unread: 2, customer: "客户 A-1842",
    amount: "$2,680", progress: 62, heroTone: "emerald", waiting: "请上传今日制作进度",
    specs: { 主石: "圆形 · 1.52ct · E / VS1 · CVD", 戒托: "PT950 铂金", 尺寸: "US 5.5", 刻字: "L & J · 07.20" },
    referenceNotes: "戒臂要细，六爪对称。客户希望主石尽量显大，但不要高托。",
    feedback: "戒臂可以再细一点吗？目标 1.7mm，其余都确认。",
    steps: [
      { title: "订单已确认", meta: "7月10日 09:42", done: true },
      { title: "CAD v2 已通过", meta: "7月11日 16:18", done: true },
      { title: "进入制作", meta: "7月12日 10:05", done: true },
      { title: "制作进度", meta: "等待今日更新", current: true },
      { title: "终检 QC", meta: "待开始" },
    ],
  },
  {
    code: "BD-260713-03", title: "椭圆主石隐形光环", category: "戒指", stage: "待确认", stageKey: "new",
    due: "今天 18:00", dueTone: "urgent", updated: "34分钟前", unread: 1, customer: "客户 A-1760",
    amount: "$3,120", progress: 18, heroTone: "rose", waiting: "需要确认报价与交期",
    specs: { 主石: "椭圆 · 1.80–2.00ct · F+ / VS1+", 戒托: "18K 玫瑰金", 尺寸: "US 6", 刻字: "无" },
    referenceNotes: "需要根据参考图给出 CAD 与工期，副石不要太抢主石。",
    feedback: "尚无客户反馈",
    steps: [
      { title: "新订单分配", meta: "7月13日 14:21", done: true },
      { title: "确认报价与交期", meta: "今天 18:00 前", current: true },
      { title: "上传 CAD", meta: "待开始" },
      { title: "客户确认", meta: "待开始" },
    ],
  },
  {
    code: "BD-260709-11", title: "祖母绿切割吊坠", category: "吊坠", stage: "客户审核", stageKey: "review",
    due: "7月22日", updated: "2小时前", unread: 0, customer: "客户 A-1688",
    amount: "$1,860", progress: 42, heroTone: "blue", waiting: "客户正在审核 CAD v1",
    specs: { 主石: "祖母绿形 · 1.20ct · F / VVS2", 金属: "18K 白金", 链长: "45cm", 刻字: "无" },
    referenceNotes: "极简四爪，吊坠背面需要留出清洁开口。",
    feedback: "正在等待客户回复",
    steps: [
      { title: "订单已确认", meta: "7月9日", done: true },
      { title: "CAD v1 已上传", meta: "7月13日 11:20", done: true },
      { title: "客户审核", meta: "已等待 2 小时", current: true },
      { title: "进入制作", meta: "待开始" },
    ],
  },
  {
    code: "BD-260701-02", title: "半圈排钻婚戒", category: "戒指", stage: "终检", stageKey: "qc",
    due: "7月16日", dueTone: "warn", updated: "昨天", unread: 0, customer: "客户 A-1519",
    amount: "$1,240", progress: 86, heroTone: "gold", waiting: "请上传成品照片与质检结果",
    specs: { 钻石: "圆钻 · 0.35ct 总重", 戒托: "18K 黄金", 尺寸: "US 4.75", 刻字: "Always" },
    referenceNotes: "成品图需要包含正面、侧面、刻字和上手比例。",
    feedback: "CAD 已确认，无修改。",
    steps: [
      { title: "订单已确认", meta: "7月1日", done: true },
      { title: "CAD 已通过", meta: "7月3日", done: true },
      { title: "制作完成", meta: "7月13日", done: true },
      { title: "终检 QC", meta: "等待上传", current: true },
      { title: "交付平台", meta: "待开始" },
    ],
  },
];

export const inventory = [
  { id: "POOL-700021", shape: "圆形", carat: "1.52", grade: "E · VS1", cert: "IGI 655482310", price: "$510", status: "可用", media: 3 },
  { id: "POOL-700018", shape: "椭圆", carat: "1.86", grade: "F · VVS2", cert: "IGI 645782199", price: "$690", status: "已预留", media: 2 },
  { id: "POOL-700014", shape: "祖母绿形", carat: "1.20", grade: "F · VVS2", cert: "IGI 645120876", price: "$480", status: "可用", media: 4 },
  { id: "POOL-700006", shape: "公主方", carat: "2.01", grade: "G · VS1", cert: "IGI 632019845", price: "$760", status: "已售", media: 2 },
];
