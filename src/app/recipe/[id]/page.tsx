import { notFound } from "next/navigation";
import { getRecipeById } from "@/lib/db";
import RecipeDetailView from "@/components/RecipeDetailView";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface RecipePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
  const { id } = await params;
  const recipe = getRecipeById(id);
  if (!recipe) {
    return { title: "Recipe Not Found — Chef Mom" };
  }

  return {
    title: `${recipe.title} — Chef Mom`,
    description: recipe.description || `Cook ${recipe.title} with step-by-step directions on Chef Mom.`,
  };
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params;
  const recipe = getRecipeById(id);

  if (!recipe) {
    notFound();
  }

  return <RecipeDetailView recipe={recipe} />;
}
