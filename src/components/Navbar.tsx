"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CookingPot,
  Home,
  History,
  Search,
  Heart,
  User,
  LogIn,
  LogOut,
  X,
  Check
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { getSavedRecipes } from "@/lib/indexedDb";
import GlassIcon from "@/components/GlassIcon";
import BrandLogo from "@/components/BrandLogo";

interface AuthUser {
  name: string;
  email: string;
}

export default function Navbar() {
  const pathname = usePathname();
  const [savedCount, setSavedCount] = useState<number>(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isModalAnimating, setIsModalAnimating] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [user, setUser] = useState<AuthUser | null>(null);

  // Sign-in form state
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");

  const profileRef = useRef<HTMLDivElement>(null);

  // Open modal with opening animation
  const openLoginModal = (mode: "signin" | "signup" = "signin") => {
    setAuthMode(mode);
    setIsLoginModalOpen(true);
    requestAnimationFrame(() => {
      setIsModalAnimating(true);
    });
  };

  // Close modal with dismissal animation
  const closeLoginModal = () => {
    setIsModalAnimating(false);
    setTimeout(() => {
      setIsLoginModalOpen(false);
      setNameInput("");
      setEmailInput("");
    }, 200);
  };

  // Load saved count & persisted auth session
  useEffect(() => {
    async function loadCounts() {
      try {
        const saved = await getSavedRecipes();
        setSavedCount(saved.length);
      } catch {}
    }
    loadCounts();

    const interval = setInterval(loadCounts, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pm_auth_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Close profile dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
        if (isLoginModalOpen) {
          closeLoginModal();
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLoginModalOpen]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    let finalName = nameInput.trim();
    if (!finalName) {
      const handle = emailInput.split("@")[0] || "Chef";
      finalName = handle.charAt(0).toUpperCase() + handle.slice(1);
    }

    const newUser: AuthUser = {
      name: finalName,
      email: emailInput.trim(),
    };
    setUser(newUser);
    try {
      localStorage.setItem("pm_auth_user", JSON.stringify(newUser));
    } catch {}
    closeLoginModal();
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem("pm_auth_user");
    } catch {}
    setIsProfileOpen(false);
  };

  const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/generate", label: "Generate", icon: CookingPot },
    { href: "/discover", label: "Discover", icon: Search },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#D5DED3] bg-[#E9EEE5]/90 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo on the Left */}
          <BrandLogo size="md" />

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-white shadow-editorial"
                      : "text-foreground/80 hover:bg-secondary/40 hover:text-primary"
                  }`}
                >
                  <GlassIcon
                    icon={Icon}
                    size="xs"
                    className="h-6 w-6"
                    isActive={isActive}
                    iconClassName={isActive ? "text-[#171A14]" : "text-[#3D423A]"}
                  />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Top-Right Controls: Saved (Heart) & User Profile with Apple Liquid Glass */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* 1. Saved Dishes Heart Button */}
            <Link
              href="/saved"
              aria-label="Saved Dishes"
              className="relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] group/saved focus:outline-none transition-transform active:scale-95"
            >
              <GlassIcon
                icon={Heart}
                size="md"
                isActive={pathname === "/saved"}
                isFilled={pathname === "/saved"}
                className={pathname === "/saved" ? "ring-2 ring-accent/30 scale-105" : ""}
                iconClassName={
                  pathname === "/saved"
                    ? "text-accent fill-accent"
                    : "text-[#242825] group-hover/saved:text-accent"
                }
              />
              {savedCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-xs z-20">
                  {savedCount}
                </span>
              )}
            </Link>

            {/* 2. User Profile Dropdown Button */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                aria-expanded={isProfileOpen}
                aria-label="User profile menu"
                className="relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] focus:outline-none transition-transform active:scale-95"
              >
                <GlassIcon
                  icon={user ? undefined : User}
                  size="md"
                  isActive={isProfileOpen}
                  className={isProfileOpen ? "ring-2 ring-primary/25 scale-105" : ""}
                  iconClassName="text-[#242825]"
                >
                  {user && (
                    <span className="font-serif font-bold text-xs uppercase text-primary">
                      {user.name.charAt(0)}
                    </span>
                  )}
                </GlassIcon>
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 rounded-2xl border border-[#D5DED3] bg-[#FAFAF6] p-2 shadow-[0_12px_36px_rgba(36,59,48,0.12)] backdrop-blur-md z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* User Details Section */}
                  <div className="px-3 py-2.5">
                    {user ? (
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-serif font-bold text-sm uppercase">
                          {user.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-serif font-bold text-primary truncate">
                            {user.name}
                          </p>
                          <p className="text-xs text-muted truncate">{user.email}</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="flex h-2 w-2 rounded-full bg-accent" />
                          <p className="text-sm font-serif font-bold text-primary">Guest Chef</p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          Sign in to personalize your kitchen
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="my-1 border-t border-secondary/60" />

                  {/* Previous Dishes Option with History/Clock Icon */}
                  <Link
                    href="/dishes"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/40 hover:text-primary transition-colors group/history"
                  >
                    <GlassIcon
                      icon={History}
                      size="xs"
                      className="shrink-0"
                      iconClassName="text-[#242825] group-hover/history:text-primary"
                    />
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-xs text-primary">Previous Dishes</span>
                      <span className="text-[10px] text-muted">View generated dish history</span>
                    </div>
                  </Link>

                  <div className="my-1 border-t border-secondary/60" />

                  {/* Login / Logout Option */}
                  {user ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="text-xs font-semibold">Log out</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        openLoginModal("signin");
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <LogIn className="h-4 w-4" />
                      <span className="text-xs font-semibold">Log in / Sign up</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Apple iOS Translucent Glass Auth Modal (Sign In / Sign Up) */}
      {isLoginModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-md transition-opacity duration-200 ease-out ${
            isModalAnimating ? "opacity-100" : "opacity-0"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeLoginModal();
            }
          }}
        >
          <div
            className={`relative w-full max-w-sm rounded-[28px] border border-white/70 bg-white/80 p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.06)] transition-all duration-200 ease-out transform ${
              isModalAnimating
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 translate-y-2"
            }`}
            style={{
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              backdropFilter: "blur(24px) saturate(180%)",
            }}
          >
            {/* iOS Close Button */}
            <button
              type="button"
              onClick={closeLoginModal}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200/60 hover:bg-neutral-300/70 text-neutral-600 hover:text-neutral-900 transition-colors focus:outline-none"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Brand Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[14px] shadow-[0_4px_14px_rgba(36,71,53,0.12)] ring-1 ring-black/5 bg-[#F7F3EA]">
                <Image
                  src="/icons/chef-mom-logo.png"
                  alt="Chef Mom"
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h3
                  id="auth-modal-title"
                  className="text-lg font-black tracking-[-0.02em] text-primary"
                  style={{
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Display", sans-serif',
                  }}
                >
                  {authMode === "signin" ? "Sign In to Chef Mom" : "Join Chef Mom"}
                </h3>
                <p className="text-[11px] text-neutral-500 font-medium leading-tight">
                  {authMode === "signin"
                    ? "Welcome back to Chef Mom"
                    : "Join Chef Mom today"}
                </p>
              </div>
            </div>

            {/* Apple Segmented Control for Sign In / Sign Up */}
            <div className="mt-4 grid grid-cols-2 p-1 rounded-xl bg-neutral-200/60 backdrop-blur-xs text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAuthMode("signin")}
                className={`py-1.5 rounded-lg transition-all text-center ${
                  authMode === "signin"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`py-1.5 rounded-lg transition-all text-center ${
                  authMode === "signup"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                Sign Up
              </button>
            </div>

            <p className="mt-3 text-xs text-neutral-600 leading-relaxed">
              {authMode === "signin"
                ? "Enter your credentials to access your saved recipes and kitchen history."
                : "Personalize your cooking experience, save your favourites, and organize recipes."}
            </p>

            <form onSubmit={handleLoginSubmit} className="mt-4 space-y-3.5">
              {authMode === "signup" && (
                <div className="animate-in fade-in duration-150">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. Maya Chen"
                    className="w-full rounded-xl border border-neutral-300/70 bg-white/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 outline-none transition-all focus:border-primary focus:bg-white/90 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="e.g. maya@example.com"
                  className="w-full rounded-xl border border-neutral-300/70 bg-white/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 outline-none transition-all focus:border-primary focus:bg-white/90 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              {authMode === "signin" && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Chef Name <span className="text-[10px] font-normal text-muted">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. Maya Chen"
                    className="w-full rounded-xl border border-neutral-300/70 bg-white/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60 outline-none transition-all focus:border-primary focus:bg-white/90 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeLoginModal}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-primary px-5 py-2 text-xs font-bold text-white shadow-editorial hover:bg-primary-dark active:scale-95 transition-all"
                >
                  {authMode === "signin" ? "Sign In" : "Create Account"}
                </button>
              </div>
            </form>

            <div className="mt-4 pt-3 border-t border-neutral-200/60 text-center text-xs text-neutral-500">
              {authMode === "signin" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthMode("signup")}
                    className="font-semibold text-primary hover:underline ml-1"
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthMode("signin")}
                    className="font-semibold text-primary hover:underline ml-1"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
