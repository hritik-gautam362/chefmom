"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, X } from "lucide-react";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Register service worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((err) => {
          console.log("ServiceWorker registration failed: ", err);
        });
      });
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if dismissed previously in session
      if (!sessionStorage.getItem("pwa_dismissed")) {
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("pwa_dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-secondary bg-white p-4 shadow-editorial-lg md:bottom-6 md:right-6 md:left-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[13px] shadow-sm ring-1 ring-black/5 bg-[#F7F3EA]">
            <Image
              src="/icons/chef-mom-logo.png"
              alt="Chef Mom App Icon"
              width={44}
              height={44}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h4
              className="text-sm font-black tracking-[-0.02em] text-primary"
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Display", sans-serif',
              }}
            >
              Install Chef Mom
            </h4>
            <p className="text-xs text-muted">Cooking companion with one tap on your home screen.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstall}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-editorial transition-colors hover:bg-primary-dark"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
            className="rounded-full p-1 text-muted hover:bg-secondary/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
