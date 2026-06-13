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
  
  addDashboardCard(card: Omit<DashboardCardData, "cardId">, tab?: string): string;
  addPreviewTab(tab: Omit<PreviewTabData, "tabId"> & { tabId?: string; type?: "replace" | "append" }): void;
  removeDashboardCard(tab: string, cardId: string): void;
  removeDashboardTab(tab: string): void;
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
    
    addDashboardCard(card, tab = "Dashboard"): string {
      if (!state.tabs[tab]) {
        state.tabs[tab] = [];
      }
      const existingIndex = state.tabs[tab].findIndex(c => c.title === card.title);
      if (existingIndex >= 0) {
        const existingCardId = state.tabs[tab][existingIndex].cardId;
        state.tabs[tab][existingIndex] = {
          ...card,
          cardId: existingCardId,
        };
        notify();
        return existingCardId;
      }
      const cardId = generateCardId();
      state.tabs[tab].push({
        ...card,
        cardId,
      });
      if (!state.activeKey.startsWith("dashboard-")) {
        state.activeKey = `dashboard-${tab}`;
      }
      notify();
      return cardId;
    },
    
    addPreviewTab(tab): void {
      const existingTabIndex = tab.tabId
        ? state.previewTabs.findIndex(t => t.tabId === tab.tabId)
        : -1;

      if (existingTabIndex >= 0) {
        if (tab.type === "replace") {
          state.previewTabs[existingTabIndex] = {
            title: tab.title ?? state.previewTabs[existingTabIndex].title,
            children: tab.children,
            tabId: tab.tabId!,
            url: tab.url ?? state.previewTabs[existingTabIndex].url,
            iframeId: tab.iframeId ?? state.previewTabs[existingTabIndex].iframeId,
            data: tab.data ?? state.previewTabs[existingTabIndex].data,
          };
        } else {
          state.previewTabs[existingTabIndex] = {
            ...state.previewTabs[existingTabIndex],
            children: [...state.previewTabs[existingTabIndex].children, ...tab.children],
          };
        }
        state.activeKey = tab.tabId!;
      } else {
        const newTabId = tab.tabId ?? generateTabId();
        const newTab: PreviewTabData = {
          title: tab.title,
          children: tab.children,
          tabId: newTabId,
          url: tab.url,
          iframeId: tab.iframeId,
          data: tab.data,
        };
        state.previewTabs.push(newTab);
        state.activeKey = newTabId;
      }
      notify();
    },
    
    removeDashboardCard(tab, cardId): void {
      if (state.tabs[tab]) {
        state.tabs[tab] = state.tabs[tab].filter(c => c.cardId !== cardId);
        notify();
      }
    },
    
    removeDashboardTab(tab): void {
      delete state.tabs[tab];
      if (state.activeKey === `dashboard-${tab}`) {
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