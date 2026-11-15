"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "icon-only";
  showTagline?: boolean;
  className?: string;
  href?: string;
}

export default function BrandLogo({
  size = "md",
  showTagline = true,
  className = "",
  href = "/",
}: BrandLogoProps) {
  // Dimensions & scaling
  const dimensions = {
    sm: { img: 36, wordmarkH: 22, tag: "text-[9px]" },
    md: { img: 46, wordmarkH: 28, tag: "text-[10px] sm:text-[11px]" },
    lg: { img: 56, wordmarkH: 34, tag: "text-xs" },
    "icon-only": { img: 42, wordmarkH: 0, tag: "" },
  }[size];

  const content = (
    <div className={`group flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {/* 1. Existing small square Chef Mom illustrated logo on the left */}
      <div
        className="relative shrink-0 overflow-hidden rounded-[13px] sm:rounded-[15px] shadow-[0_2px_10px_rgba(36,59,48,0.08)] ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105 active:scale-95 bg-[#FAFAF6]"
        style={{
          width: dimensions.img,
          height: dimensions.img,
        }}
      >
        <Image
          src="/icons/chef-mom-logo.png"
          alt="Chef Mom"
          width={dimensions.img * 2}
          height={dimensions.img * 2}
          priority
          className="h-full w-full object-cover"
        />
      </div>

      {/* 2 & 3 & 4 & 5. Wordmark Image to its right & Tagline directly underneath */}
      {size !== "icon-only" && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center">
            <Image
              src="/icons/chef-mom-wordmark.png"
              alt="Chef Mom"
              width={Math.round(dimensions.wordmarkH * 3.18)}
              height={dimensions.wordmarkH}
              priority
              className="h-[24px] sm:h-[28px] w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </div>

          {showTagline && (
            <span
              className={`font-sans font-medium tracking-wide text-[#69766C] leading-tight mt-0.5 whitespace-nowrap ${dimensions.tag}`}
            >
              Let the Magic Begin
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} aria-label="Chef Mom Home" className="focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
