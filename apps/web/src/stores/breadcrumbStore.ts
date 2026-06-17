import { create } from 'zustand';
import { useEffect } from 'react';

interface BreadcrumbState {
  /** Title shown as the final breadcrumb crumb on detail pages (e.g. a record name). */
  detailTitle: string | null;
  setDetailTitle: (title: string | null) => void;
}

export const useBreadcrumbStore = create<BreadcrumbState>((set) => ({
  detailTitle: null,
  setDetailTitle: (title) => set({ detailTitle: title }),
}));

/**
 * Detail pages call this with the resolved record name so the TopBar breadcrumb
 * reads "Leads › Jane Smith" instead of "Leads › Detail". Clears on unmount.
 */
export function useDetailBreadcrumb(title: string | null | undefined) {
  const setDetailTitle = useBreadcrumbStore((s) => s.setDetailTitle);
  useEffect(() => {
    setDetailTitle(title ?? null);
    return () => setDetailTitle(null);
  }, [title, setDetailTitle]);
}
