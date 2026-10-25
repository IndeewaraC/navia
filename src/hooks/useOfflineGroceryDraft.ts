import { useState, useEffect, useCallback, useRef } from 'react';

interface GroceryPricing {
  taxAndFees: number;
  discounts: number;
  manualTotal: number | null;
}

const DEFAULT_PRICING: GroceryPricing = { taxAndFees: 0, discounts: 0, manualTotal: null };

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
  pricing?: GroceryPricing;
}

export function useOfflineGroceryDraft(tripId: string, initialDraft: GroceryItem[] = [], initialStoreName: string = 'Local Supermarket') {
  const [items, setItems] = useState<GroceryItem[]>(initialDraft);
  const [storeName, setStoreName] = useState<string>(initialStoreName);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  const [pricing, setPricing] = useState<GroceryPricing>(DEFAULT_PRICING);
  const pricingRef = useRef(pricing);
  const itemsRef = useRef(items);

  // Initialize network listeners and hydrate from local cache on mount
  useEffect(() => {
    // Browser storage and connectivity are unavailable during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOffline(!navigator.onLine);

    const cachedDraft = localStorage.getItem(`navia_grocery_draft_${tripId}`);
    if (cachedDraft) {
      try {
        const parsed = JSON.parse(cachedDraft);
        // Migration: If it's the old array format, convert it
        if (Array.isArray(parsed)) {
          setItems(parsed);
          itemsRef.current = parsed;
          setStoreName('Local Supermarket');
          setPendingSync(true);
        } else {
          // New object format
          setItems(parsed.items || []);
          itemsRef.current = parsed.items || [];
          const cachedPricing = { ...DEFAULT_PRICING, ...parsed.pricing };
          setPricing(cachedPricing);
          pricingRef.current = cachedPricing;
          setStoreName(parsed.storeName || 'Local Supermarket');
          setPendingSync(true);
        }
      } catch (e) {
        console.error('Failed to parse offline draft', e);
      }
    } else if (initialDraft.length > 0) {
      setItems(initialDraft);
      itemsRef.current = initialDraft;
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
      pricing: pricingRef.current,
      lastUpdated: Date.now()
    };
    localStorage.setItem(`navia_grocery_draft_${tripId}`, JSON.stringify(payload));
    setPendingSync(true);
  }, [tripId]);

  const saveDraft = useCallback(() => {
    saveToStorage(storeName, itemsRef.current);
  }, [storeName, saveToStorage]);

  const updatePricing = useCallback((updates: Partial<GroceryPricing>) => {
    pricingRef.current = { ...pricingRef.current, ...updates };
    setPricing(pricingRef.current);
    saveToStorage(storeName, itemsRef.current);
  }, [storeName, saveToStorage]);

  const updateStoreName = useCallback((newName: string) => {
    setStoreName(newName);
    saveToStorage(newName, items);
  }, [items, saveToStorage]);

  // Atomic update function that immediately writes to disk
  const updateItem = useCallback((id: string, updates: Partial<GroceryItem>) => {
    const nextState = itemsRef.current.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    itemsRef.current = nextState;
    setItems(nextState);
    saveToStorage(storeName, nextState);
  }, [storeName, saveToStorage]);

  // Clear cache post-sync
  const clearDraft = useCallback(() => {
    localStorage.removeItem(`navia_grocery_draft_${tripId}`);
    setPendingSync(false);
  }, [tripId]);

  const addItem = useCallback((name: string) => {
    const newItem: GroceryItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name,
      shelfPrice: 0,
      isChecked: false
    };
    const nextState = [...itemsRef.current, newItem];
    itemsRef.current = nextState;
    setItems(nextState);
    saveToStorage(storeName, nextState);
  }, [storeName, saveToStorage]);

  const removeItem = useCallback((id: string) => {
    const nextState = itemsRef.current.filter(item => item.id !== id);
    itemsRef.current = nextState;
    setItems(nextState);
    saveToStorage(storeName, nextState);
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
    saveDraft,
    clearDraft, 
    isOffline, 
    pendingSync,
    rawSubtotal,
    pricing,
    updatePricing
  };
}
