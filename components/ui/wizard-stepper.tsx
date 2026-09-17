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
    <nav aria-label="Progress" className={cn("w-full py-4 sm:py-6", className)}>
      <ol className="flex items-start justify-between w-full max-w-4xl mx-auto px-2 sm:px-6">
        {steps.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          const isUpcoming = step.id > currentStep;
          const isClickable = onStepClick && step.id <= maxAccessibleStep && !isActive;

          const nextStep = steps[idx + 1];
          const isNextCompletedOrActive = nextStep && nextStep.id <= currentStep;

          return (
            <React.Fragment key={step.id}>
              {/* Step Circle & Text */}
              <li className="relative flex flex-col items-center flex-shrink-0">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick(step.id)}
                  className={cn(
                    "flex flex-col items-center focus:outline-none transition-all duration-200",
                    isClickable ? "cursor-pointer hover:opacity-90" : "cursor-default",
                  )}
                >
                  {/* Circle Badge matching user's exact design */}
                  <div
                    className={cn(
                      "size-11 sm:size-13 md:size-14 rounded-full flex items-center justify-center font-bold text-sm sm:text-base md:text-lg transition-all duration-200 select-none",
                      isActive &&
                        "bg-[#3B82F6] text-white ring-[8px] sm:ring-[10px] ring-blue-100 dark:ring-blue-900/40 shadow-xs",
                      isCompleted &&
                        "bg-[#3B82F6] text-white hover:brightness-105 shadow-xs",
                      isUpcoming &&
                        "bg-[#8598AF] dark:bg-slate-600 text-white shadow-xs",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="size-4 sm:size-5 md:size-6 stroke-[2.8]" />
                    ) : (
                      <span>{step.id}</span>
                    )}
                  </div>

                  {/* Text Labels below circle */}
                  <div className="mt-2.5 sm:mt-3 text-center min-w-[70px] sm:min-w-[90px] max-w-[130px]">
                    <span
                      className={cn(
                        "text-xs sm:text-sm md:text-[15px] font-bold block transition-colors duration-200 leading-tight",
                        isActive && "text-[#2563EB] dark:text-blue-400",
                        isCompleted && "text-[#2563EB] dark:text-blue-400",
                        isUpcoming && "text-[#486581] dark:text-slate-300",
                      )}
                    >
                      {step.title}
                    </span>
                    {step.description && (
                      <span className="text-[11px] sm:text-xs md:text-[13px] text-[#556980] dark:text-slate-400 font-medium block mt-0.5 sm:mt-1 leading-snug">
                        {step.description}
                      </span>
                    )}
                  </div>
                </button>
              </li>

              {/* Connecting Line between steps - vertically centered with circle */}
              {idx < steps.length - 1 && (
                <li
                  aria-hidden="true"
                  className="flex-1 flex items-center justify-center px-1.5 sm:px-3 md:px-4 mt-5 sm:mt-6 md:mt-[26px]"
                >
                  <div
                    className={cn(
                      "h-[3px] sm:h-[3.5px] w-full max-w-[50px] sm:max-w-[70px] rounded-full transition-colors duration-300",
                      isNextCompletedOrActive
                        ? "bg-[#3B82F6] dark:bg-blue-500"
                        : "bg-[#DCE4EE] dark:bg-slate-700",
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
