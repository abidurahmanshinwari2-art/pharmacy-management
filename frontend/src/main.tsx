import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LookProvider } from "./appearance";
import { AuthProvider } from "./auth";
import { LanguageProvider } from "./i18n";
import { ShopProvider } from "./shop";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LookProvider>
        <LanguageProvider>
          <AuthProvider>
            <ShopProvider>
              <App />
            </ShopProvider>
          </AuthProvider>
        </LanguageProvider>
      </LookProvider>
    </BrowserRouter>
  </React.StrictMode>
);
