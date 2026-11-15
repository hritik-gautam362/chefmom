"use client";

import React from "react";
import {
  LucideIcon,
  Home,
  CookingPot,
  Search,
  BookOpen,
  Heart,
  User,
  History,
  Clock,
  Utensils,
  ShoppingCart,
  ChefHat,
  ArrowLeft,
  Share2,
  Play,
  RotateCcw,
  Check,
  Plus,
  X,
  SlidersHorizontal,
  Flame,
  AlertCircle
} from "lucide-react";

export type GlassIconSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Professional, culinary-focused icon mapping.
 * Eliminates generic AI sparkles and travel compasses in favor of
 * clean, recognizable culinary and navigation symbols.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  // Navigation & Core Actions
  home: Home,
  generate: CookingPot,
  cook: CookingPot,
  pot: CookingPot,
  "cooking-pot": CookingPot,
  recipe: CookingPot,
  discover: Search,
  browse: Search,
  search: Search,
  book: BookOpen,
  "book-open": BookOpen,
  saved: Heart,
  heart: Heart,
  profile: User,
  user: User,
  history: History,
  dishes: History,
  clock: Clock,
  time: Clock,

  // Fallback mappings to guarantee no generic sparkles/compasses leak through
  sparkles: CookingPot,
  compass: Search,

  // Utility & Details
  utensils: Utensils,
  chef: ChefHat,
  "chef-hat": ChefHat,
  cart: ShoppingCart,
  shopping: ShoppingCart,
  "shopping-cart": ShoppingCart,
  arrowleft: ArrowLeft,
  "arrow-left": ArrowLeft,
  share: Share2,
  play: Play,
  reset: RotateCcw,
  check: Check,
  plus: Plus,
  close: X,
  filter: SlidersHorizontal,
  flame: Flame,
  alert: AlertCircle,
};

export type GlassIconName =
  | "home"
  | "generate"
  | "cook"
  | "pot"
  | "discover"
  | "browse"
  | "search"
  | "saved"
  | "heart"
  | "profile"
  | "user"
  | "history"
  | "dishes"
  | "clock"
  | "utensils"
  | "chef"
  | string;

interface GlassIconProps {
  name?: GlassIconName;
  icon?: LucideIcon;
  size?: GlassIconSize;
  className?: string;
  iconClassName?: string;
  isActive?: boolean;
  isFilled?: boolean;
  activeColor?: string;
  children?: React.ReactNode;
}

const SIZE_MAP: Record<GlassIconSize, { container: string; icon: string }> = {
  xs: {
    container: "h-7 w-7 min-w-[1.75rem]",
    icon: "h-3.5 w-3.5",
  },
  sm: {
    container: "h-9 w-9 min-w-[2.25rem]",
    icon: "h-4.5 w-4.5",
  },
  md: {
    container: "h-11 w-11 min-w-[2.75rem]",
    icon: "h-5 w-5",
  },
  lg: {
    container: "h-12 w-12 min-w-[3rem]",
    icon: "h-6 w-6",
  },
  xl: {
    container: "h-16 w-16 min-w-[4rem]",
    icon: "h-7 w-7 sm:h-8 sm:w-8",
  },
};

/**
 * Editorial Glass Icon
 * Calm, refined frosted glass container with consistent 2px stroke width,
 * clean neutral tones, and subtle depth.
 */
export default function GlassIcon({
  name,
  icon: IconProp,
  size = "md",
  className = "",
  iconClassName = "",
  isActive = false,
  isFilled = false,
  children,
}: GlassIconProps) {
  const config = SIZE_MAP[size] || SIZE_MAP.md;
  const ResolvedIcon = IconProp || (name ? ICON_MAP[name.toLowerCase()] : undefined);

  return (
    <div
      className={`group/glass relative inline-flex items-center justify-center rounded-full aspect-square transition-all duration-200 ease-out select-none ${
        config.container
      } ${
        isActive
          ? "scale-[1.03]"
          : "hover:scale-105 active:scale-95"
      } ${className}`}
      style={{
        background: isActive
          ? "radial-gradient(135% 135% at 30% 20%, rgba(250, 250, 246, 0.85) 0%, rgba(250, 250, 246, 0.55) 60%, rgba(233, 238, 229, 0.55) 100%)"
          : "radial-gradient(135% 135% at 30% 20%, rgba(250, 250, 246, 0.72) 0%, rgba(250, 250, 246, 0.42) 60%, rgba(233, 238, 229, 0.45) 100%)",
        border: isActive
          ? "1px solid rgba(255, 255, 255, 0.9)"
          : "1px solid rgba(255, 255, 255, 0.75)",
        boxShadow: isActive
          ? "inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.98), inset 0 -1px 2px 0 rgba(36, 59, 48, 0.05), 0 8px 24px -2px rgba(36, 59, 48, 0.12), 0 2px 6px -1px rgba(36, 59, 48, 0.04)"
          : "inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.92), inset 0 -1px 2px 0 rgba(36, 59, 48, 0.03), 0 6px 20px -3px rgba(36, 59, 48, 0.08), 0 2px 6px -1px rgba(36, 59, 48, 0.03)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        backdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {/* Subtle glossy top light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 top-0.5 h-[40%] rounded-full opacity-75 bg-gradient-to-b from-white/95 via-white/40 to-transparent"
      />

      {/* Crisp Icon with consistent stroke */}
      <div className="relative z-10 flex items-center justify-center transition-transform duration-200 group-hover/glass:scale-105">
        {ResolvedIcon ? (
          <ResolvedIcon
            className={`stroke-[2] transition-colors duration-200 ${
              isActive
                ? "text-[#294638]"
                : "text-[#243B30] group-hover/glass:text-[#294638]"
            } ${
              isFilled ? "fill-current" : ""
            } ${config.icon} ${iconClassName}`}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
