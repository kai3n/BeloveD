import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

const sampleFile = new URL("../../public/favicon.png", import.meta.url).pathname;
const states = [];

async function record(expectedText) {
  await page.getByText(expectedText, { exact: false }).first().waitFor();
  states.push(expectedText);
}

async function uploadCurrent(actionName, fields = {}) {
  await page.getByRole("button", { name: actionName }).first().click();
  for (const [label, value] of Object.entries(fields)) {
    const input = page.getByLabel(label, { exact: true });
    if (value === true) await input.check();
    else await input.fill(value);
  }
  await page.locator('input[type="file"]').setInputFiles(sampleFile);
  await page.getByRole("button", { name: /提交订单团队审核/ }).click();
  await page.locator(".sheet-layer").waitFor({ state: "detached" });
}

async function operationsAction(name) {
  await page.getByRole("button", { name }).first().click();
}

try {
  await page.goto(process.env.VENDOR_URL || "http://127.0.0.1:5177/", { waitUntil: "networkidle" });
  await page.getByText("JOB-100102", { exact: true }).last().click();
  await record("请确认接单与承诺交期");
  await page.getByRole("button", { name: "接受任务" }).first().click();
  await record("请提交本订单专属候选钻批次");

  await uploadCurrent("提交候选钻批次", {
    "候选数量": "10",
    "批次有效期": "2026-08-31",
    "IGI 证书号（每行一个）": "IGI-655482310\nIGI-655482311",
    "我已确认以上候选当前可用，并会在填写的临时保留期内保留": true,
  });
  await record("等待 Operations 审核");
  await page.getByRole("button", { name: "Operations 审核" }).click();
  await operationsAction("批准并发布候选");
  await record("等待客户选择");
  await operationsAction("记录客户选择并锁钻");
  await record("选中钻石已锁定");
  await operationsAction("开放供应报价任务");
  await record("请提交金重、工费、材料费和交期");

  await page.getByRole("button", { name: "供货商视角" }).click();
  await uploadCurrent("提交重量与工费报价", {
    "预计净金重（g）": "4.8",
    "损耗（%）": "6",
    "工费": "1200",
    "配石／材料费": "300",
    "生产周期（天）": "18",
    "估算假设": "PT950，US 6 戒围，1.5ct 主石",
  });
  await page.getByRole("button", { name: "Operations 审核" }).click();
  await operationsAction("确认供应报价");
  await operationsAction("生成并发送客户报价");
  await record("等待客户确认报价");
  await operationsAction("记录客户已接受报价");
  await record("等待定金");
  await operationsAction("确认定金到账并开放 CAD");
  await record("请上传第一版 CAD");

  await page.getByRole("button", { name: "供货商视角" }).click();
  await uploadCurrent("上传设计文件");
  await page.getByRole("button", { name: "Operations 审核" }).click();
  await operationsAction("内部通过并发送客户");
  await record("等待客户确认 CAD");
  await operationsAction("记录客户批准 CAD");

  await page.getByRole("button", { name: "供货商视角" }).click();
  await operationsAction("确认并开始制作");
  await uploadCurrent("上传制作进度");
  await page.getByRole("button", { name: "Operations 审核" }).click();
  await operationsAction("批准并进入终检");

  await page.getByRole("button", { name: "供货商视角" }).click();
  await uploadCurrent("上传终检证据");
  await page.getByRole("button", { name: "Operations 审核" }).click();
  await operationsAction("批准终检");
  await page.getByRole("button", { name: "供货商视角" }).click();
  await operationsAction("确认并准备交付");
  await page.getByRole("button", { name: "Operations 审核" }).click();
  await operationsAction("确认收货并完成");
  await record("订单履约已完成");

  const timeline = await page.locator(".timeline > div").evaluateAll((items) => items.map((item) => ({
    text: item.textContent,
    done: item.classList.contains("done"),
  })));
  if (!timeline.every((step) => step.done)) throw new Error("Completed order still has unfinished timeline steps");
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(" | ")}`);
  await page.screenshot({ path: "/private/tmp/vendor-flow-completed.png", fullPage: true });
  console.log(JSON.stringify({ ok: true, states, completedTimelineSteps: timeline.length }, null, 2));
} finally {
  await browser.close();
}
