"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Play, Pause, RotateCcw, Check, ListChecks } from "lucide-react";
import { Recipe } from "@/lib/types";
import confetti from "canvas-confetti";

interface CookingModeModalProps {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
}

export default function CookingModeModal({ recipe, servings, onClose }: CookingModeModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [showIngredients, setShowIngredients] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);

  const steps = recipe.instructions || [];
  const currentStep = steps[currentStepIndex] || {
    step: 1,
    title: "Prepare",
    instruction: "Follow standard cooking directions.",
  };

  const scale = servings / (recipe.servings || 4);

  // Initialize timer whenever step changes
  useEffect(() => {
    if (currentStep.time_minutes && currentStep.time_minutes > 0) {
      setTimerSeconds(currentStep.time_minutes * 60);
      setTimerActive(false);
    } else {
      setTimerSeconds(0);
      setTimerActive(false);
    }
  }, [currentStepIndex, currentStep.time_minutes]);

  // Timer countdown
  useEffect(() => {
    let interval: any = null;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && timerActive) {
      setTimerActive(false);
      try {
        confetti({ particleCount: 50, spread: 60 });
      } catch {}
    }
    return () => clearInterval(interval);
  }, [timerActive, timerSeconds]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Completed last step!
      try {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      } catch {}
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPct = Math.round(((currentStepIndex + 1) / Math.max(1, steps.length)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1A3527] text-white">
      {/* Top Header */}
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="font-serif text-sm font-semibold tracking-wide text-secondary-light">
            Cooking Mode: {recipe.title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowIngredients(!showIngredients)}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 transition-colors"
          >
            <ListChecks className="h-4 w-4 text-accent" />
            <span>{showIngredients ? "Hide Ingredients" : "View Ingredients"}</span>
          </button>
          <button
            onClick={onClose}
            aria-label="Exit cooking mode"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-white/10">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Main Body */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-12 text-center max-w-3xl mx-auto overflow-y-auto">
        {/* Step Indicator */}
        <span className="font-serif text-sm font-bold tracking-widest text-accent uppercase">
          Step {currentStepIndex + 1} of {steps.length}
        </span>

        {/* Step Title */}
        <h2 className="mt-3 font-serif text-2xl font-bold sm:text-3xl text-white">
          {currentStep.title}
        </h2>

        {/* Big Readable Instruction */}
        <p className="mt-6 text-lg sm:text-2xl leading-relaxed text-secondary-light font-medium max-w-2xl">
          {currentStep.instruction}
        </p>

        {/* Optional Interactive Timer */}
        {currentStep.time_minutes && currentStep.time_minutes > 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
            <span className="text-xs uppercase tracking-wider text-secondary-light">Recommended Timer</span>
            <span className="font-serif text-4xl font-extrabold my-2 text-white font-mono">
              {formatTimer(timerSeconds)}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => setTimerActive(!timerActive)}
                className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold hover:bg-accent-hover transition-colors"
              >
                {timerActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                <span>{timerActive ? "Pause" : "Start"}</span>
              </button>
              <button
                onClick={() => {
                  setTimerActive(false);
                  setTimerSeconds((currentStep.time_minutes || 0) * 60);
                }}
                className="rounded-full bg-white/10 p-1.5 hover:bg-white/20 transition-colors"
                aria-label="Reset timer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Overlay Ingredients Drawer if toggled */}
        {showIngredients && (
          <div className="absolute inset-x-4 top-4 bottom-4 z-20 overflow-y-auto rounded-3xl bg-[#244735] p-6 text-left shadow-2xl border border-white/20">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-serif text-lg font-bold text-white">Ingredients ({servings} servings)</h3>
              <button
                onClick={() => setShowIngredients(false)}
                className="text-xs font-bold text-secondary-light hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {recipe.ingredients.map((ing, i) => {
                const qty = ing.quantity ? Math.round(ing.quantity * scale * 10) / 10 : null;
                return (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-white/5">
                    <span className="font-semibold text-accent">{qty ? `${qty} ${ing.unit}` : ""}</span>
                    <span className="text-secondary-light capitalize">{ing.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Navigation */}
      <div className="flex h-20 items-center justify-between border-t border-white/10 px-6 sm:px-12 bg-black/20 backdrop-blur-md">
        <button
          onClick={handlePrev}
          disabled={currentStepIndex === 0}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
            currentStepIndex === 0
              ? "opacity-30 cursor-not-allowed text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
        >
          <ChevronLeft className="h-5 w-5" />
          <span>Previous</span>
        </button>

        <span className="text-xs font-bold text-secondary-light">
          {currentStepIndex + 1} / {steps.length}
        </span>

        {currentStepIndex < steps.length - 1 ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-white shadow-editorial hover:bg-accent-hover transition-all"
          >
            <span>Next Step</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-editorial hover:bg-emerald-700 transition-all"
          >
            <Check className="h-5 w-5" />
            <span>Finish Cooking!</span>
          </button>
        )}
      </div>
    </div>
  );
}
