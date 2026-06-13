import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./Layout.jsx";
import NotFound from "./NotFound.jsx";
import { RequireRole } from "./lib/auth.jsx";
// 공개 스토어프론트 — 모든 방문자가 즉시 보는 화면은 eager 로드
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Diamonds from "./pages/Diamonds.jsx";
import DiamondDetail from "./pages/DiamondDetail.jsx";
import StyleCatalog from "./pages/StyleCatalog.jsx";
import IntakeForm from "./pages/IntakeForm.jsx";
import ClientPortal, { TrackEntry } from "./pages/ClientPortal.jsx";
import DealerApply from "./pages/DealerApply.jsx";

// 역할 전용·저빈도 화면은 코드 스플릿 — 고객은 어드민/딜러/벤더 코드를 받지 않는다
const StaffLogin = lazy(() => import("./pages/StaffLogin.jsx"));
const VendorLogin = lazy(() => import("./pages/VendorLogin.jsx"));
const named = (p, key) => lazy(() => p().then((m) => ({ default: m[key] })));
const CustomerShell = lazy(() => import("./pages/Account.jsx"));
const AccountOrders = named(() => import("./pages/Account.jsx"), "AccountOrders");
const GuideLabDiamond = named(() => import("./pages/Guide.jsx"), "GuideLabDiamond");
const Guide4C = named(() => import("./pages/Guide.jsx"), "Guide4C");
const DealerShell = lazy(() => import("./pages/dealer/DealerShell.jsx"));
const DealerDashboard = named(() => import("./pages/dealer/DealerShell.jsx"), "DealerDashboard");
const DealerCatalog = lazy(() => import("./pages/dealer/DealerCatalog.jsx"));
const DealerOrders = lazy(() => import("./pages/dealer/DealerOrders.jsx"));
const DealerRegs = lazy(() => import("./pages/dealer/DealerRegs.jsx"));
const DealerClaims = lazy(() => import("./pages/dealer/DealerClaims.jsx"));
const DealerPolicies = lazy(() => import("./pages/dealer/DealerPolicies.jsx"));
const SupplierShell = lazy(() => import("./pages/supplier/SupplierShell.jsx"));
const SupplierQueue = lazy(() => import("./pages/supplier/SupplierQueue.jsx"));
const SupplierTask = lazy(() => import("./pages/supplier/SupplierTask.jsx"));
const SupplierPool = lazy(() => import("./pages/supplier/SupplierPool.jsx"));
const Admin = lazy(() => import("./pages/admin/Admin.jsx"));
const AdminDashboard = named(() => import("./pages/admin/Admin.jsx"), "AdminDashboard");
const AdminOpsOrders = lazy(() => import("./pages/admin/AdminOpsOrders.jsx"));
const AdminOpsOrder = lazy(() => import("./pages/admin/AdminOpsOrder.jsx"));
const AdminOpsStyles = lazy(() => import("./pages/admin/AdminOpsStyles.jsx"));
const AdminBenchmark = lazy(() => import("./pages/admin/AdminBenchmark.jsx"));
const AdminDiamonds = lazy(() => import("./pages/admin/AdminDiamonds.jsx"));
const AdminPool = lazy(() => import("./pages/admin/AdminPool.jsx"));
const AdminVendors = lazy(() => import("./pages/admin/AdminVendors.jsx"));
const AdminDealers = lazy(() => import("./pages/admin/AdminDealers.jsx"));
const AdminCatalogW = lazy(() => import("./pages/admin/AdminCatalogW.jsx"));
const AdminWholesale = lazy(() => import("./pages/admin/AdminWholesale.jsx"));
const AdminClaims = lazy(() => import("./pages/admin/AdminClaims.jsx"));
const AdminWarranty = lazy(() => import("./pages/admin/AdminWarranty.jsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.jsx"));

export default function App() {
  return (
    <Suspense fallback={<div className="page"><p className="page-sub">…</p></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="staff" element={<StaffLogin />} />
          <Route path="vendor" element={<VendorLogin />} />
          <Route path="diamonds" element={<Diamonds />} />
          <Route path="diamonds/:id" element={<DiamondDetail />} />
          <Route path="styles" element={<StyleCatalog />} />
          <Route path="custom/new" element={<IntakeForm />} />
          <Route path="track" element={<TrackEntry />} />
          <Route path="track/:orderId" element={<ClientPortal />} />
          <Route path="guide/lab-diamond" element={<GuideLabDiamond />} />
          <Route path="guide/4c" element={<Guide4C />} />
          <Route path="account" element={<RequireRole role="customer"><CustomerShell /></RequireRole>}>
            <Route index element={<AccountOrders />} />
          </Route>
          <Route path="dealers/apply" element={<DealerApply />} />
          <Route path="dealer" element={<RequireRole role="dealer"><DealerShell /></RequireRole>}>
            <Route index element={<DealerDashboard />} />
            <Route path="catalog" element={<DealerCatalog />} />
            <Route path="orders" element={<DealerOrders />} />
            <Route path="registrations" element={<DealerRegs />} />
            <Route path="claims" element={<DealerClaims />} />
            <Route path="policies" element={<DealerPolicies />} />
          </Route>
          <Route path="supplier" element={<RequireRole role="supplier"><SupplierShell /></RequireRole>}>
            <Route index element={<SupplierQueue />} />
            <Route path="pool" element={<SupplierPool />} />
          </Route>
          <Route path="supplier/tasks/:prId" element={<RequireRole role="supplier"><SupplierTask /></RequireRole>} />
          <Route path="admin" element={<RequireRole role="admin"><Admin /></RequireRole>}>
            <Route index element={<AdminDashboard />} />
            <Route path="ops" element={<AdminOpsOrders />} />
            <Route path="ops/:orderId" element={<AdminOpsOrder />} />
            <Route path="styles" element={<AdminOpsStyles />} />
            <Route path="benchmark" element={<AdminBenchmark />} />
            <Route path="diamonds" element={<AdminDiamonds />} />
            <Route path="pool" element={<AdminPool />} />
            <Route path="vendors" element={<AdminVendors />} />
            <Route path="dealers" element={<AdminDealers />} />
            <Route path="catalog" element={<AdminCatalogW />} />
            <Route path="wholesale" element={<AdminWholesale />} />
            <Route path="claims" element={<AdminClaims />} />
            <Route path="warranty" element={<AdminWarranty />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
