import { useState, useEffect, useCallback } from 'react';

export interface GroceryItem {
  id: string;
  name: string;
  shelfPrice: number;
  isChecked: boolean;
}

export function useOfflineGroceryDraft(tripId: string, initialDraft: GroceryItem[] = []) {
  const [items, setItems] = useState<GroceryItem[]>(initialDraft);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);

  // Initialize network listeners and hydrate from local cache on mount
  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const cachedDraft = localStorage.getItem(`navia_grocery_draft_${tripId}`);
    if (cachedDraft) {
      setItems(JSON.parse(cachedDraft));
      setPendingSync(true); // Flag that local data exists and needs eventual sync
    } else if (initialDraft.length > 0) {
      setItems(initialDraft);
    }

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [tripId, initialDraft]);

  // Atomic update function that immediately writes to disk
  const updateItem = useCallback((id: string, updates: Partial<GroceryItem>) => {
    setItems((prevItems) => {
      const nextState = prevItems.map(item => 
        item.id === id ? { ...item, ...updates } : item
      );
      
      // Persist to local storage instantly so progress survives app crashes or reloads
      localStorage.setItem(`navia_grocery_draft_${tripId}`, JSON.stringify(nextState));
      setPendingSync(true);
      
      return nextState;
    });
  }, [tripId]);

  // Clear cache post-sync
  const clearDraft = useCallback(() => {
    localStorage.removeItem(`navia_grocery_draft_${tripId}`);
    setPendingSync(false);
  }, [tripId]);

  // Real-time subtotal calculation powered by the cached state
  const rawSubtotal = items
    .filter(item => item.isChecked)
    .reduce((sum, item) => sum + item.shelfPrice, 0);

  return { 
    items, 
    updateItem, 
    clearDraft, 
    isOffline, 
    pendingSync,
    rawSubtotal 
  };
}
