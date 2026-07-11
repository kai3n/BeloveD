import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./Layout.jsx";
import NotFound from "./NotFound.jsx";
import { RequireRole } from "./lib/auth.jsx";
import { WITH_BACKOFFICE } from "./lib/flags.js";
import { track } from "./lib/track.js";
// 공개 스토어프론트 — 모든 방문자가 즉시 보는 화면은 eager 로드
import Home from "./pages/Home.jsx";

// Customer Web plus an admin-only back office. Vendor and dealer surfaces stay out of this app.
const named = (p, key) => lazy(() => p().then((m) => ({ default: m[key] })));
const Login = lazy(() => import("./pages/Login.jsx"));
const StyleCatalog = lazy(() => import("./pages/StyleCatalog.jsx"));
const StyleDetail = lazy(() => import("./pages/StyleDetail.jsx"));
const IntakeForm = lazy(() => import("./pages/IntakeForm.jsx"));
const ClientPortal = lazy(() => import("./pages/ClientPortal.jsx"));
const TrackEntry = named(() => import("./pages/ClientPortal.jsx"), "TrackEntry");
const CustomerShell = lazy(() => import("./pages/Account.jsx"));
const AccountOrders = named(() => import("./pages/Account.jsx"), "AccountOrders");
const ReviewNew = lazy(() => import("./pages/ReviewNew.jsx"));
// 백오피스·내부 목업 — 공개 배포 번들에서는 제외 (vite define으로 트리셰이킹)
const StaffLogin = WITH_BACKOFFICE ? lazy(() => import("./pages/StaffLogin.jsx")) : null;
const Admin = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/Admin.jsx")) : null;
const AdminOpsStyles = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminOpsStyles.jsx")) : null;
const AdminReviews = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminReviews.jsx")) : null;
const AdminChat = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminChat.jsx")) : null;
const AdminBenchmark = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminBenchmark.jsx")) : null;
const AdminMetals = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminMetals.jsx")) : null;
const AdminPayments = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminPayments.jsx")) : null;
const AdminCoupons = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminCoupons.jsx")) : null;
const AdminMembers = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminMembers.jsx")) : null;
const AdminCustomers = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminCustomers.jsx")) : null;
const AdminMemberTimeline = WITH_BACKOFFICE ? named(() => import("./pages/admin/AdminMembers.jsx"), "AdminMemberTimeline") : null;
const AdminLiveOrders = WITH_BACKOFFICE ? lazy(() => import("./pages/admin/AdminLiveOrders.jsx")) : null;
const AdminLiveOrderDetail = WITH_BACKOFFICE ? named(() => import("./pages/admin/AdminLiveOrders.jsx"), "AdminLiveOrderDetail") : null;
const CustomBuilderMockup = WITH_BACKOFFICE ? lazy(() => import("./pages/CustomBuilderMockup.jsx")) : null;
const CustomFlowMockup = WITH_BACKOFFICE ? lazy(() => import("./pages/CustomFlowMockup.jsx")) : null;
const IntakeStoneMockup = WITH_BACKOFFICE ? lazy(() => import("./pages/IntakeStoneMockup.jsx")) : null;
const Process = lazy(() => import("./pages/Process.jsx"));
const InfoPage = lazy(() => import("./pages/Info.jsx"));
const GuideHub = named(() => import("./pages/Guide.jsx"), "GuideHub");
const GuideLabDiamond = named(() => import("./pages/Guide.jsx"), "GuideLabDiamond");
const Guide4C = named(() => import("./pages/Guide.jsx"), "Guide4C");
const GuideShapes = named(() => import("./pages/Guide.jsx"), "GuideShapes");

// 라우트 이동마다 page_view 1건 — track.js가 어드민·게이트 경로는 스스로 거른다
function PageViewTracker() {
  const location = useLocation();
  useEffect(() => { track("page_view", { path: location.pathname }); }, [location.pathname]);
  return null;
}

export default function App() {
  return (
    <Suspense fallback={<div className="page" role="status" aria-live="polite"><p className="page-sub">Loading…</p></div>}>
      <PageViewTracker />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="sign-in" element={<Login />} />
          {/* 어드민 게이트 — 추측 불가 경로. 어디에도 링크하지 않는다(직접 접속/북마크 전용). */}
          {WITH_BACKOFFICE && <Route path="gate-7f3k9x" element={<StaffLogin />} />}
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
          <Route path="guide/shapes" element={<GuideShapes />} />
          <Route path="about" element={<InfoPage page="about" />} />
          <Route path="returns" element={<InfoPage page="returns" />} />
          <Route path="warranty" element={<InfoPage page="warranty" />} />
          <Route path="shipping" element={<InfoPage page="shipping" />} />
          <Route path="privacy" element={<InfoPage page="privacy" />} />
          <Route path="contact" element={<InfoPage page="contact" />} />
          <Route path="faq" element={<InfoPage page="faq" />} />
          <Route path="account" element={<RequireRole role="customer"><CustomerShell /></RequireRole>}>
            <Route index element={<AccountOrders />} />
          </Route>
          {/* 구 어드민 경로 — 존재를 드러내지 않고 홈으로 (미인증 접근과 동일한 겉모습) */}
          <Route path="admin" element={<Navigate to="/" replace />} />
          <Route path="admin/*" element={<Navigate to="/" replace />} />
          {WITH_BACKOFFICE && (
            <Route path="bo-4q9z7m" element={<RequireRole role="admin"><Admin /></RequireRole>}>
              <Route index element={<Navigate to="/bo-4q9z7m/live" replace />} />
              {/* 구 데모 워크벤치(DM-) 라우트 — 실서버 콘솔로 통합되며 제거 */}
              <Route path="orders" element={<Navigate to="/bo-4q9z7m/live" replace />} />
              <Route path="orders/:orderId" element={<Navigate to="/bo-4q9z7m/live" replace />} />
              <Route path="designs" element={<AdminOpsStyles />} />
              <Route path="styles" element={<Navigate to="/bo-4q9z7m/designs" replace />} />
              <Route path="ops" element={<Navigate to="/bo-4q9z7m/live" replace />} />
              <Route path="benchmark" element={<AdminBenchmark />} />
              <Route path="metals" element={<AdminMetals />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="coupons" element={<AdminCoupons />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="chat" element={<AdminChat />} />
              <Route path="live" element={<AdminLiveOrders />} />
              <Route path="live/:orderCode" element={<AdminLiveOrderDetail />} />
              <Route path="members" element={<AdminCustomers />} />
              <Route path="analytics" element={<AdminMembers />} />
              <Route path="analytics/:memberId" element={<AdminMemberTimeline />} />
              <Route path="members/:memberId" element={<AdminMemberTimeline />} />
              <Route path="diamonds" element={<Navigate to="/bo-4q9z7m/benchmark" replace />} />
              <Route path="settings" element={<Navigate to="/bo-4q9z7m/live" replace />} />
            </Route>
          )}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
