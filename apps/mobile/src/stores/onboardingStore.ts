import { create } from "zustand";

export type OnboardingStep = "account-creation" | "profile-setup" | "phone-verification" | "complete";

interface OnboardingState {
  steps: OnboardingStep[];
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  optionalSteps: OnboardingStep[];

  completeStep: (step: OnboardingStep) => void;
  skipStep: (step: OnboardingStep) => void;
  goToStep: (step: OnboardingStep) => void;
  resetOnboarding: () => void;
}

const DEFAULT_STEPS: OnboardingStep[] = ["account-creation", "phone-verification", "profile-setup", "complete"];

export const useOnboardingStore = create<OnboardingState>((set) => ({
  steps: DEFAULT_STEPS,
  currentStep: "account-creation",
  completedSteps: [],
  optionalSteps: [],

  completeStep: (step) =>
    set((state) => {
      const newCompletedSteps = [...state.completedSteps];
      if (!newCompletedSteps.includes(step)) {
        newCompletedSteps.push(step);
      }

      const currentIndex = state.steps.indexOf(step);
      const nextStep = currentIndex < state.steps.length - 1 ? state.steps[currentIndex + 1] : "complete";

      return {
        completedSteps: newCompletedSteps,
        currentStep: nextStep,
      };
    }),

  skipStep: (step) =>
    set((state) => {
      const currentIndex = state.steps.indexOf(step);
      const nextStep = currentIndex < state.steps.length - 1 ? state.steps[currentIndex + 1] : "complete";

      return { currentStep: nextStep };
    }),

  goToStep: (step) => set({ currentStep: step }),

  resetOnboarding: () =>
    set({
      currentStep: "account-creation",
      completedSteps: [],
    }),
}));
