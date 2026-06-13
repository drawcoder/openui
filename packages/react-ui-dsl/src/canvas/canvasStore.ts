export interface DashboardCardData {
  title?: string;
  children: unknown[];
  size?: { w?: number };
  cardId: string;
}

export interface PreviewTabData {
  title: string;
  children: unknown[];
  tabId: string;
  url?: string;
  iframeId?: string;
  data?: Record<string, unknown>;
}

export interface CanvasStoreState {
  tabs: Record<string, DashboardCardData[]>;
  previewTabs: PreviewTabData[];
  activeKey: string;
}

export interface CanvasStore {
  tabs: Record<string, DashboardCardData[]>;
  previewTabs: PreviewTabData[];
  activeKey: string;
  
  addDashboardCard(card: Omit<DashboardCardData, "cardId">, tabId?: string): string;
  addPreviewCard(card: Omit<PreviewTabData, "tabId">, tabId?: string, type?: "replace" | "append"): void;
  removeDashboardCard(tabId: string, cardId: string): void;
  removeDashboardTab(tabId: string): void;
  removePreviewTab(tabId: string): void;
  setActiveKey(key: string): void;
  clear(): void;
  
  subscribe(listener: () => void): () => void;
  getSnapshot(): CanvasStoreState;
}

let cardIdCounter = 0;
let tabIdCounter = 0;

function generateCardId(): string {
  cardIdCounter++;
  return `card-${cardIdCounter}`;
}

function generateTabId(): string {
  tabIdCounter++;
  return `preview-${tabIdCounter}`;
}

function createCanvasStoreInternal(): CanvasStore {
  const state: CanvasStoreState = {
    tabs: {},
    previewTabs: [],
    activeKey: "dashboard-Dashboard",
  };
  
  const listeners: Set<() => void> = new Set();
  
  function notify() {
    listeners.forEach(listener => listener());
  }
  
  return {
    tabs: state.tabs,
    previewTabs: state.previewTabs,
    activeKey: state.activeKey,
    
    addDashboardCard(card, tabId = "Dashboard"): string {
      if (!state.tabs[tabId]) {
        state.tabs[tabId] = [];
      }
      const existingIndex = state.tabs[tabId].findIndex(c => c.title === card.title);
      if (existingIndex >= 0) {
        const existingCardId = state.tabs[tabId][existingIndex].cardId;
        state.tabs[tabId][existingIndex] = {
          ...card,
          cardId: existingCardId,
        };
        notify();
        return existingCardId;
      }
      const cardId = generateCardId();
      state.tabs[tabId].push({
        ...card,
        cardId,
      });
      if (!state.activeKey.startsWith("dashboard-")) {
        state.activeKey = `dashboard-${tabId}`;
      }
      notify();
      return cardId;
    },
    addPreviewCard(card, tabId, type = "append"): void {
      const resolvedTabId = tabId ?? generateTabId();
      const existingTabIndex = tabId
        ? state.previewTabs.findIndex(t => t.tabId === tabId)
        : -1;

      if (existingTabIndex >= 0) {
        if (type === "replace") {
          state.previewTabs[existingTabIndex] = {
            title: card.title ?? state.previewTabs[existingTabIndex].title,
            children: card.children,
            tabId: tabId!,
            url: card.url ?? state.previewTabs[existingTabIndex].url,
            iframeId: card.iframeId ?? state.previewTabs[existingTabIndex].iframeId,
            data: card.data ?? state.previewTabs[existingTabIndex].data,
          };
        } else {
          state.previewTabs[existingTabIndex] = {
            ...state.previewTabs[existingTabIndex],
            children: [...state.previewTabs[existingTabIndex].children, ...card.children],
          };
        }
        state.activeKey = tabId!;
      } else {
        const newTab: PreviewTabData = {
          title: card.title,
          children: card.children,
          tabId: resolvedTabId,
          url: card.url,
          iframeId: card.iframeId,
          data: card.data,
        };
        state.previewTabs.push(newTab);
        state.activeKey = resolvedTabId;
      }
      notify();
    },
    removeDashboardCard(tabId, cardId): void {
      if (state.tabs[tabId]) {
        state.tabs[tabId] = state.tabs[tabId].filter(c => c.cardId !== cardId);
        notify();
      }
    },
    
    removeDashboardTab(tabId): void {
      delete state.tabs[tabId];
      if (state.activeKey === `dashboard-${tabId}`) {
        const firstRemaining = Object.keys(state.tabs).find(k => state.tabs[k].length > 0);
        if (firstRemaining) {
          state.activeKey = `dashboard-${firstRemaining}`;
        } else if (state.previewTabs.length > 0) {
          state.activeKey = state.previewTabs[0].tabId;
        } else {
          state.activeKey = "dashboard-Dashboard";
        }
      }
      notify();
    },
    
    removePreviewTab(tabId): void {
      state.previewTabs = state.previewTabs.filter(t => t.tabId !== tabId);
      if (state.activeKey === tabId) {
        const firstDash = Object.keys(state.tabs).find(k => state.tabs[k].length > 0);
        if (firstDash) {
          state.activeKey = `dashboard-${firstDash}`;
        } else if (state.previewTabs.length > 0) {
          state.activeKey = state.previewTabs[0].tabId;
        } else {
          state.activeKey = "dashboard-Dashboard";
        }
      }
      notify();
    },
    
    setActiveKey(key): void {
      state.activeKey = key;
      notify();
    },
    
    clear(): void {
      state.tabs = {};
      state.previewTabs = [];
      state.activeKey = "dashboard-Dashboard";
      notify();
    },
    
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    
    getSnapshot(): CanvasStoreState {
      return {
        tabs: { ...state.tabs },
        previewTabs: [...state.previewTabs],
        activeKey: state.activeKey,
      };
    },
  };
}

export const canvasStore = createCanvasStoreInternal();