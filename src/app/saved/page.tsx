import SavedAndShopping from "@/components/SavedAndShopping";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Recipes & Shopping List — Chef Mom",
  description: "View your bookmarked recipes and organized grocery shopping list.",
};

export default function SavedPage() {
  return <SavedAndShopping />;
}
