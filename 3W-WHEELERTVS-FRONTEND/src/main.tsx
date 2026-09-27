// Polyfill crypto.randomUUID for non-secure HTTP contexts (e.g. IP addresses)
if (typeof window !== "undefined") {
  if (!window.crypto) {
    (window as any).crypto = {};
  }
  if (typeof window.crypto.randomUUID !== "function") {
    (window.crypto as any).randomUUID = function () {
      return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c: any) =>
        (
          c ^
          (window.crypto.getRandomValues
            ? window.crypto.getRandomValues(new Uint8Array(1))[0]
            : (Math.random() * 16) | 0) &
            (15 >> (c / 4))
        ).toString(16)
      );
    };
  }
  if (typeof (Object.prototype as any).startsWith === "undefined") {
    Object.defineProperty(Object.prototype, "startsWith", {
      value: function (search: any, pos?: any) {
        if (typeof this === "string") return String.prototype.startsWith.call(this, search, pos);
        try {
          if (this && typeof (this as any).id === "string") return (this as any).id.startsWith(search, pos);
          if (this && typeof (this as any).url === "string") return (this as any).url.startsWith(search, pos);
          return String(this).startsWith(search, pos);
        } catch {
          return false;
        }
      },
      configurable: true,
      writable: true,
    });
  }
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { LogoProvider } from "./context/LogoContext";
import { AuthProvider } from "./context/AuthContext";
import { SidebarProvider } from "./context/SidebarContext";
import { NotificationProvider } from "./context/NotificationContext";
import { migrateLocalStorageForms } from "./utils/migrateLocalStorage";
import "./index.css";

migrateLocalStorageForms();

// Automatically reload page when a new deployment invalidates old chunk hashes
window.addEventListener("vite:preloadError", (event) => {
  console.warn("Vite preload error detected. Reloading page to fetch latest deployment...");
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <LogoProvider>
          <SidebarProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </SidebarProvider>
        </LogoProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
