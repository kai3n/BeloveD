import { Route, Routes } from "react-router-dom";
import Layout from "./Layout.jsx";
import NotFound from "./NotFound.jsx";
import { RequireRole } from "./lib/auth.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Diamonds from "./pages/Diamonds.jsx";
import DiamondDetail from "./pages/DiamondDetail.jsx";
import Templates from "./pages/Templates.jsx";
import CustomWizard from "./pages/CustomWizard.jsx";
import Account from "./pages/Account.jsx";
import RequestDetail from "./pages/RequestDetail.jsx";
import { Guide4C, GuideLabDiamond } from "./pages/Guide.jsx";
import VendorQueue from "./pages/vendor/VendorQueue.jsx";
import VendorRequest from "./pages/vendor/VendorRequest.jsx";
import Admin, { AdminDashboard } from "./pages/admin/Admin.jsx";
import AdminDiamonds from "./pages/admin/AdminDiamonds.jsx";
import AdminTemplates from "./pages/admin/AdminTemplates.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminVendors from "./pages/admin/AdminVendors.jsx";
import AdminSettings from "./pages/admin/AdminSettings.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="diamonds" element={<Diamonds />} />
        <Route path="diamonds/:id" element={<DiamondDetail />} />
        <Route path="templates" element={<Templates />} />
        <Route path="custom/new" element={<CustomWizard />} />
        <Route path="guide/lab-diamond" element={<GuideLabDiamond />} />
        <Route path="guide/4c" element={<Guide4C />} />
        <Route path="account" element={<RequireRole role="customer"><Account /></RequireRole>} />
        <Route path="account/requests/:id" element={<RequireRole role="customer"><RequestDetail /></RequireRole>} />
        <Route path="vendor" element={<RequireRole role="vendor"><VendorQueue /></RequireRole>} />
        <Route path="vendor/requests/:id" element={<RequireRole role="vendor"><VendorRequest /></RequireRole>} />
        <Route path="admin" element={<RequireRole role="admin"><Admin /></RequireRole>}>
          <Route index element={<AdminDashboard />} />
          <Route path="diamonds" element={<AdminDiamonds />} />
          <Route path="templates" element={<AdminTemplates />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="vendors" element={<AdminVendors />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
