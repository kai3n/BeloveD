import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { LocaleProvider } from "./i18n.jsx";
import { AuthProvider } from "./lib/auth.jsx";
import { ThemeProvider } from "./theme.jsx";
import { syncCatalogFromServer } from "./lib/serverSync.js";
import "./styles.css";
import "./platform.css";
import "./admin.css";

// 카탈로그·가격·설정을 서버 값으로 하이드레이션 — 완료되면 스토어 구독자들이 리렌더된다
syncCatalogFromServer();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ThemeProvider>
        <LocaleProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
