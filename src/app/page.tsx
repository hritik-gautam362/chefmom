import IngredientSelector from "@/components/IngredientSelector";
import RecipeCard from "@/components/RecipeCard";
import GlassIcon from "@/components/GlassIcon";
import { getDatabase, formatRecipeRow } from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { Recipe } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function HomePage() {
  // Fetch a small set of featured recipes for the editorial highlight section below
  let featuredRecipes: Recipe[] = [];
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM recipes 
      WHERE rating >= 4.7 AND total_time_minutes <= 45
      ORDER BY review_count DESC 
      LIMIT 3
    `).all();
    featuredRecipes = rows.map((r) => formatRecipeRow(r));
  } catch (err) {
    console.error("Home featured error:", err);
  }

  return (
    <div className="mx-auto max-w-6xl xl:max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      {/* Editorial Welcome Hero */}
      <section className="text-center pt-2 pb-6 sm:pt-6 sm:pb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#D5DED3] bg-[#FAFAF6]/90 px-3.5 py-1.5 shadow-xs mb-3">
          <div className="relative h-5 w-5 overflow-hidden rounded-md ring-1 ring-black/5 bg-[#FAFAF6]">
            <Image
              src="/icons/chef-mom-logo.png"
              alt="Chef Mom"
              width={20}
              height={20}
              className="h-full w-full object-cover"
            />
          </div>
          <span className="font-heading text-xs font-bold text-[#243B30] tracking-wide uppercase">
            Your Kitchen, Your Magic.
          </span>
        </div>

        <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#243B30] leading-tight">
          What are we cooking today?
        </h1>

        <p className="mt-3 text-sm sm:text-lg text-[#69766C] max-w-xl mx-auto font-medium font-sans">
          Choose what you have. Discover what you can create.
        </p>
      </section>

      {/* Main Ingredient Selection Panel */}
      <section className="rounded-3xl border border-[#D5DED3] bg-[#FAFAF6] p-4 sm:p-8 shadow-sm">
        <IngredientSelector />
      </section>

      {/* Editorial Inspiration Teaser */}
      {featuredRecipes.length > 0 && (
        <section className="mt-12 sm:mt-16 border-t border-[#D5DED3] pt-8 sm:pt-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8">
            <div>
              <span className="font-heading text-xs font-bold uppercase tracking-wider text-accent">
                Editor&apos;s Selection
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#243B30] mt-1">
                Seasonal Kitchen Inspiration
              </h2>
            </div>
            <Link
              href="/discover"
              className="mt-2 sm:mt-0 text-sm font-bold text-accent hover:underline flex items-center gap-1 font-sans"
            >
              <span>Explore all 20,500+ recipes</span>
              <span>&rarr;</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} showMatchDetails={false} />
            ))}
          </div>
        </section>
      )}

      {/* Value Pillars */}
      <section className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 border-t border-[#D5DED3] pt-8 sm:pt-12 text-center">
        <div className="rounded-2xl bg-[#FAFAF6]/90 p-5 sm:p-6 border border-[#D5DED3] shadow-xs">
          <GlassIcon name="utensils" size="lg" className="mx-auto mb-3" iconClassName="text-primary" />
          <h3 className="font-heading text-base sm:text-lg font-bold text-[#243B30]">20,500+ Curated Recipes</h3>
          <p className="mt-1.5 text-xs text-[#69766C] leading-relaxed font-sans">
            Real dishes from Indian curries to world classics with exact cooking directions, nutrition, and tips.
          </p>
        </div>

        <div className="rounded-2xl bg-[#FAFAF6]/90 p-5 sm:p-6 border border-[#D5DED3] shadow-xs">
          <GlassIcon name="generate" size="lg" className="mx-auto mb-3" iconClassName="text-accent" />
          <h3 className="font-heading text-base sm:text-lg font-bold text-[#243B30]">Intelligent Rotation</h3>
          <p className="mt-1.5 text-xs text-[#69766C] leading-relaxed font-sans">
            Selecting the same ingredients discovers different dishes each time with diverse cuisines and cooking techniques.
          </p>
        </div>

        <div className="rounded-2xl bg-[#FAFAF6]/90 p-5 sm:p-6 border border-[#D5DED3] shadow-xs">
          <GlassIcon name="clock" size="lg" className="mx-auto mb-3" iconClassName="text-primary" />
          <h3 className="font-heading text-base sm:text-lg font-bold text-[#243B30]">Distraction-Free Cooking</h3>
          <p className="mt-1.5 text-xs text-[#69766C] leading-relaxed font-sans">
            Cook step-by-step with large readable instructions, step timers, and ingredient checklists designed for phone screens.
          </p>
        </div>
      </section>
    </div>
  );
}
