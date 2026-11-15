"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CookingPot, Search } from "lucide-react";

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    {
      id: "home",
      href: "/",
      label: "Home",
      icon: Home,
      isActive: pathname === "/",
    },
    {
      id: "generate",
      href: "/generate",
      label: "Generate",
      icon: CookingPot,
      isActive: pathname === "/generate" || pathname.startsWith("/generate/"),
    },
    {
      id: "discover",
      href: "/discover",
      label: "Discover",
      icon: Search,
      isActive: pathname === "/discover" || pathname.startsWith("/discover/"),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed z-50 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[290px] sm:max-w-[320px] md:hidden select-none"
      style={{
        bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Translucent Warm-White Liquid Glass Pill */}
      <div
        className="relative grid grid-cols-3 items-center gap-1 px-2.5 py-2 rounded-full transition-all duration-300"
        style={{
          background:
            "radial-gradient(135% 135% at 50% 15%, rgba(250, 250, 246, 0.58) 0%, rgba(250, 250, 246, 0.32) 60%, rgba(233, 238, 229, 0.38) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.65)",
          boxShadow:
            "inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 2px 0 rgba(255, 255, 255, 0.35), 0 12px 36px -4px rgba(36, 59, 48, 0.12), 0 4px 12px -1px rgba(0, 0, 0, 0.04)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          backdropFilter: "blur(24px) saturate(180%)",
        }}
      >
        {/* Soft specular upper edge highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-5 top-0.5 h-[35%] rounded-full opacity-80 bg-gradient-to-b from-white/95 via-white/35 to-transparent"
        />

        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.label}
              className="group relative flex flex-col items-center justify-center min-h-[48px] py-0.5 px-1 rounded-full focus:outline-none transition-transform active:scale-95"
            >
              {/* Circular Icon Area */}
              <div
                className={`relative flex items-center justify-center h-10 w-10 sm:h-10.5 sm:w-10.5 rounded-full transition-all duration-200 ${
                  active
                    ? "bg-[#294638] text-white shadow-[0_2px_8px_rgba(41,70,56,0.3)]"
                    : "bg-transparent text-[#78867B] group-hover:text-[#294638] group-hover:bg-white/20"
                }`}
              >
                <Icon
                  className={`h-5 w-5 stroke-[2] transition-colors ${
                    active
                      ? "text-white"
                      : "text-[#78867B] group-hover:text-[#294638]"
                  }`}
                />
              </div>

              {/* Label: Deep forest green for active; muted grey-green for inactive */}
              <span
                className={`text-[11px] tracking-tight leading-none mt-1 transition-colors truncate max-w-full font-sans ${
                  active
                    ? "font-bold text-[#294638]"
                    : "font-medium text-[#78867B] group-hover:text-[#294638]"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div> 
    </nav>
  );
}
