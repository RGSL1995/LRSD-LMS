"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStepItem {
  id: number;
  title: string;
  description?: string;
}

interface WizardStepperProps {
  steps: WizardStepItem[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  maxAccessibleStep?: number;
  className?: string;
}

export function WizardStepper({
  steps,
  currentStep,
  onStepClick,
  maxAccessibleStep = currentStep,
  className,
}: WizardStepperProps) {
  return (
    <nav aria-label="Progress" className={cn("w-full py-4", className)}>
      <ol className="flex items-center justify-between w-full max-w-3xl mx-auto px-4">
        {steps.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          const isUpcoming = step.id > currentStep;
          const isClickable = onStepClick && step.id <= maxAccessibleStep && !isActive;

          // Line status between step[idx] and step[idx+1]
          const nextStep = steps[idx + 1];
          let lineClass = "bg-slate-200 dark:bg-slate-700";
          if (nextStep) {
            if (nextStep.id <= currentStep) {
              if (nextStep.id === currentStep) {
                // Line leading into the active step
                lineClass = "bg-blue-400 dark:bg-blue-500";
              } else {
                // Line between completed steps
                lineClass = "bg-emerald-500 dark:bg-emerald-500";
              }
            }
          }

          return (
            <React.Fragment key={step.id}>
              {/* Step circle + label container */}
              <li className="relative flex flex-col items-center group">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick(step.id)}
                  className={cn(
                    "flex flex-col items-center focus:outline-none transition-all duration-200",
                    isClickable ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  {/* Circle Badge */}
                  <div
                    className={cn(
                      "size-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-200 shadow-sm",
                      isCompleted &&
                        "bg-emerald-500 text-white shadow-emerald-500/20 hover:brightness-105 ring-4 ring-emerald-100 dark:ring-emerald-950/50",
                      isActive &&
                        "bg-blue-400 dark:bg-blue-500 text-white shadow-blue-500/25 ring-4 ring-blue-100 dark:ring-blue-950/60 scale-105",
                      isUpcoming &&
                        "bg-slate-400 dark:bg-slate-600 text-white/90",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="size-6 stroke-[3]" />
                    ) : (
                      <span>{step.id}</span>
                    )}
                  </div>

                  {/* Text Labels */}
                  <div className="mt-2 text-center">
                    <span
                      className={cn(
                        "text-xs md:text-sm font-semibold block transition-colors duration-200",
                        isCompleted && "text-emerald-600 dark:text-emerald-400",
                        isActive && "text-blue-500 dark:text-blue-400 font-bold",
                        isUpcoming && "text-slate-500 dark:text-slate-400",
                      )}
                    >
                      {step.title}
                    </span>
                    {step.description && (
                      <span className="hidden sm:block text-[11px] text-muted-foreground mt-0.5">
                        {step.description}
                      </span>
                    )}
                  </div>
                </button>
              </li>

              {/* Connecting Line between steps */}
              {idx < steps.length - 1 && (
                <li
                  aria-hidden="true"
                  className="flex-1 px-2 md:px-4 mb-6"
                >
                  <div
                    className={cn(
                      "h-1 w-full rounded-full transition-colors duration-300",
                      lineClass,
                    )}
                  />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
