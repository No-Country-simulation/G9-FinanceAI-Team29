import { createContext, useContext, useState } from "react";

type OnboardingContextType = {
  isTourActive: boolean;
  setIsTourActive: (active: boolean) => void;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isTourActive, setIsTourActive] = useState(false);

  return (
    <OnboardingContext.Provider value={{ isTourActive, setIsTourActive }}>
      {children}
    </OnboardingContext.Provider>
  );
};
