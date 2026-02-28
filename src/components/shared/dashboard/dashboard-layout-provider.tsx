"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Layout, ResponsiveLayouts } from 'react-grid-layout';
import { loadDashboardLayout, saveDashboardLayout, clearDashboardLayout, clearAllSectionLayouts } from './dashboard-layout-storage';

interface DashboardLayoutContextValue {
  layouts: ResponsiveLayouts;
  onLayoutChange: (currentLayout: Layout, allLayouts: ResponsiveLayouts) => void;
  resetLayout: () => void;
  isEditing: boolean;
}

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null);

interface DashboardLayoutProviderProps {
  dashboardId: string;
  defaultLayouts: ResponsiveLayouts;
  children: React.ReactNode;
}

export function DashboardLayoutProvider({
  dashboardId,
  defaultLayouts,
  children,
}: DashboardLayoutProviderProps) {
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => {
    const saved = loadDashboardLayout(dashboardId);
    return saved ?? defaultLayouts;
  });

  // Debounce save to localStorage
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLayoutChange = useCallback(
    (currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      setLayouts(allLayouts);

      // Debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveDashboardLayout(dashboardId, allLayouts);
      }, 500);
    },
    [dashboardId]
  );

  const resetLayout = useCallback(() => {
    // Clear both legacy single-dashboard layout and all section layouts
    clearDashboardLayout(dashboardId);
    clearAllSectionLayouts(dashboardId);
    setLayouts(defaultLayouts);
  }, [dashboardId, defaultLayouts]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const value = useMemo<DashboardLayoutContextValue>(
    () => ({
      layouts,
      onLayoutChange,
      resetLayout,
      isEditing: true, // Always editable for now
    }),
    [layouts, onLayoutChange, resetLayout]
  );

  return (
    <DashboardLayoutContext.Provider value={value}>
      {children}
    </DashboardLayoutContext.Provider>
  );
}

export function useDashboardLayout(): DashboardLayoutContextValue {
  const ctx = useContext(DashboardLayoutContext);
  if (!ctx) {
    throw new Error('useDashboardLayout must be used within DashboardLayoutProvider');
  }
  return ctx;
}

export function useDashboardLayoutOptional(): DashboardLayoutContextValue | null {
  return useContext(DashboardLayoutContext);
}
