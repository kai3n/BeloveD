import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./Layout.jsx";
import NotFound from "./NotFound.jsx";
import { RequireRole } from "./lib/auth.jsx";
import { WITH_BACKOFFICE } from "./lib/flags.js";
// 공개 스토어프론트 — 모든 방문자가 즉시 보는 화면은 eager 로드
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import StyleCatalog from "./pages/StyleCatalog.jsx";
import StyleDetail from "./pages/StyleDetail.jsx";
import IntakeForm from "./pages/IntakeForm.jsx";
import ClientPortal, { TrackEntry } from "./pages/ClientPortal.jsx";

// Customer Web plus an admin-only back office. Vendor and dealer surfaces stay out of this app.
const named = (p, key) => lazy(() => p().then((m) => ({ default: m[key] })));
const CustomerShell = lazy(() => import("./pages/Account.jsx"));
const AccountOrders = named(() => import("./pages/Account.jsx"), "AccountOrders");
const ReviewNew = lazy(() => import("./pages/ReviewNew.jsx"));
// 백오피스·내부 목업 — 공개 배포 번들에서는 제외 (vite define으로 트리셰이킹)
const StaffLogin = WITH_BACKOFFICE ? lazy(() => import("./pages/StaffLogin.jsx")) : null;
const Admin = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/Admin.jsx")) : null;
const AdminOpsOrders = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminOpsOrders.jsx")) : null;
const AdminOpsOrder = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminOpsOrder.jsx")) : null;
const AdminOpsStyles = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminOpsStyles.jsx")) : null;
const AdminReviews = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminReviews.jsx")) : null;
const AdminBenchmark = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminBenchmark.jsx")) : null;
const CustomBuilderMockup = WITH_BACKOFFICE ? lazy(() => import("./pages/CustomBuilderMockup.jsx")) : null;
const CustomFlowMockup = WITH_BACKOFFICE ? lazy(() => import("./pages/CustomFlowMockup.jsx")) : null;
const IntakeStoneMockup = WITH_BACKOFFICE ? lazy(() => import("./pages/IntakeStoneMockup.jsx")) : null;
const Process = lazy(() => import("./pages/Process.jsx"));
const InfoPage = lazy(() => import("./pages/Info.jsx"));
const GuideHub = named(() => import("./pages/Guide.jsx"), "GuideHub");
const GuideLabDiamond = named(() => import("./pages/Guide.jsx"), "GuideLabDiamond");
const Guide4C = named(() => import("./pages/Guide.jsx"), "Guide4C");

export default function App() {
  return (
    <Suspense fallback={<div className="page"><p className="page-sub">…</p></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="sign-in" element={<Login />} />
          {WITH_BACKOFFICE && <Route path="staff" element={<StaffLogin />} />}
          <Route path="designs" element={<StyleCatalog />} />
          <Route path="designs/:id" element={<StyleDetail />} />
          <Route path="styles" element={<Navigate to="/designs" replace />} />
          <Route path="styles/:id" element={<StyleDetail />} />
          <Route path="process" element={<Process />} />
          {WITH_BACKOFFICE && <Route path="custom/mockup" element={<CustomBuilderMockup />} />}
          {WITH_BACKOFFICE && <Route path="custom/flow-mockup" element={<CustomFlowMockup />} />}
          {WITH_BACKOFFICE && <Route path="custom/stone-mockup" element={<IntakeStoneMockup />} />}
          <Route path="custom/new" element={<IntakeForm />} />
          <Route path="reviews/new" element={<ReviewNew />} />
          <Route path="track" element={<TrackEntry />} />
          <Route path="track/:orderId" element={<ClientPortal />} />
          <Route path="orders/:orderId" element={<ClientPortal />} />
          <Route path="guide" element={<GuideHub />} />
          <Route path="guide/lab-diamond" element={<GuideLabDiamond />} />
          <Route path="guide/4c" element={<Guide4C />} />
          <Route path="about" element={<InfoPage page="about" />} />
          <Route path="returns" element={<InfoPage page="returns" />} />
          <Route path="warranty" element={<InfoPage page="warranty" />} />
          <Route path="shipping" element={<InfoPage page="shipping" />} />
          <Route path="contact" element={<InfoPage page="contact" />} />
          <Route path="faq" element={<InfoPage page="faq" />} />
          <Route path="account" element={<RequireRole role="customer"><CustomerShell /></RequireRole>}>
            <Route index element={<AccountOrders />} />
          </Route>
          {WITH_BACKOFFICE && (
            <Route path="admin" element={<RequireRole role="admin"><Admin /></RequireRole>}>
              <Route index element={<Navigate to="/admin/orders" replace />} />
              <Route path="orders" element={<AdminOpsOrders />} />
              <Route path="orders/:orderId" element={<AdminOpsOrder />} />
              <Route path="designs" element={<AdminOpsStyles />} />
              <Route path="styles" element={<Navigate to="/admin/designs" replace />} />
              <Route path="ops" element={<Navigate to="/admin/orders" replace />} />
              <Route path="ops/:orderId" element={<AdminOpsOrder />} />
              <Route path="benchmark" element={<AdminBenchmark />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="diamonds" element={<Navigate to="/admin/benchmark" replace />} />
              <Route path="settings" element={<Navigate to="/admin/orders" replace />} />
            </Route>
          )}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
