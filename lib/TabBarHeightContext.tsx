import React, { createContext, useContext, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabBarHeightContextType = {
  tabBarHeight: number;
  setTabBarHeight: (height: number) => void;
};

const TabBarHeightContext = createContext<TabBarHeightContextType | undefined>(undefined);

export function TabBarHeightProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  // Provide a sane default height to prevent the "zero padding" visual jank on cold start.
  // 65 is roughly the base height of the custom tab bar icons/text.
  const [tabBarHeight, setTabBarHeight] = useState(65 + insets.bottom);

  return (
    <TabBarHeightContext.Provider value={{ tabBarHeight, setTabBarHeight }}>
      {children}
    </TabBarHeightContext.Provider>
  );
}

export function useTabBarHeight() {
  const context = useContext(TabBarHeightContext);
  if (context === undefined) {
    throw new Error('useTabBarHeight must be used within a TabBarHeightProvider');
  }
  return context;
}
