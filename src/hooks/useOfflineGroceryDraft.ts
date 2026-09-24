import { useState, useEffect, useCallback } from 'react';

export interface GroceryItem {
  id: string;
  name: string;
  shelfPrice: number;
  isChecked: boolean;
}

export interface GroceryDraftPayload {
  storeName: string;
  items: GroceryItem[];
  lastUpdated: number;
}

export function useOfflineGroceryDraft(tripId: string, initialDraft: GroceryItem[] = [], initialStoreName: string = 'Local Supermarket') {
  const [items, setItems] = useState<GroceryItem[]>(initialDraft);
  const [storeName, setStoreName] = useState<string>(initialStoreName);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);

  // Initialize network listeners and hydrate from local cache on mount
  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const cachedDraft = localStorage.getItem(`navia_grocery_draft_${tripId}`);
    if (cachedDraft) {
      try {
        const parsed = JSON.parse(cachedDraft);
        // Migration: If it's the old array format, convert it
        if (Array.isArray(parsed)) {
          setItems(parsed);
          setStoreName('Local Supermarket');
          setPendingSync(true);
        } else {
          // New object format
          setItems(parsed.items || []);
          setStoreName(parsed.storeName || 'Local Supermarket');
          setPendingSync(true);
        }
      } catch (e) {
        console.error('Failed to parse offline draft', e);
      }
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

  const saveToStorage = useCallback((currentStoreName: string, currentItems: GroceryItem[]) => {
    const payload: GroceryDraftPayload = {
      storeName: currentStoreName,
      items: currentItems,
      lastUpdated: Date.now()
    };
    localStorage.setItem(`navia_grocery_draft_${tripId}`, JSON.stringify(payload));
    setPendingSync(true);
  }, [tripId]);

  const updateStoreName = useCallback((newName: string) => {
    setStoreName(newName);
    saveToStorage(newName, items);
  }, [items, saveToStorage]);

  // Atomic update function that immediately writes to disk
  const updateItem = useCallback((id: string, updates: Partial<GroceryItem>) => {
    setItems((prevItems) => {
      const nextState = prevItems.map(item => 
        item.id === id ? { ...item, ...updates } : item
      );
      saveToStorage(storeName, nextState);
      return nextState;
    });
  }, [storeName, saveToStorage]);

  // Clear cache post-sync
  const clearDraft = useCallback(() => {
    localStorage.removeItem(`navia_grocery_draft_${tripId}`);
    setPendingSync(false);
  }, [tripId]);

  const addItem = useCallback((name: string) => {
    setItems((prevItems) => {
      const newItem: GroceryItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name,
        shelfPrice: 0,
        isChecked: false
      };
      const nextState = [...prevItems, newItem];
      saveToStorage(storeName, nextState);
      return nextState;
    });
  }, [storeName, saveToStorage]);

  const removeItem = useCallback((id: string) => {
    setItems((prevItems) => {
      const nextState = prevItems.filter(item => item.id !== id);
      saveToStorage(storeName, nextState);
      return nextState;
    });
  }, [storeName, saveToStorage]);

  // Real-time subtotal calculation powered by the cached state
  const rawSubtotal = items
    .reduce((sum, item) => sum + item.shelfPrice, 0);

  return { 
    items,
    storeName,
    updateStoreName,
    updateItem, 
    addItem,
    removeItem,
    clearDraft, 
    isOffline, 
    pendingSync,
    rawSubtotal 
  };
}
