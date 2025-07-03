import { StateCreator } from 'zustand';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

export interface UISlice {
  // 状态
  theme: 'light' | 'dark' | 'auto';
  sidebarOpen: boolean;
  modalOpen: string | null; // modal的类型或ID
  notifications: Notification[];
  loading: boolean;
  
  // 操作
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (modalType: string) => void;
  closeModal: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setLoading: (loading: boolean) => void;
}

export const uiSlice: StateCreator<UISlice> = (set, get) => ({
  // 初始状态
  theme: 'auto',
  sidebarOpen: true,
  modalOpen: null,
  notifications: [],
  loading: false,
  
  // 操作函数
  setTheme: (theme) => {
    set({ theme });
    // 可以在这里添加主题切换的副作用
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      // auto模式，根据系统偏好设置
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  },
  
  toggleSidebar: () => set((state) => ({ 
    sidebarOpen: !state.sidebarOpen 
  })),
  
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  
  openModal: (modalType) => set({ modalOpen: modalType }),
  
  closeModal: () => set({ modalOpen: null }),
  
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    
    set((state) => ({
      notifications: [newNotification, ...state.notifications]
    }));
    
    // 自动移除通知
    if (notification.duration !== 0) {
      const duration = notification.duration || 5000;
      setTimeout(() => {
        get().removeNotification(newNotification.id);
      }, duration);
    }
  },
  
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  
  clearNotifications: () => set({ notifications: [] }),
  
  setLoading: (loading) => set({ loading }),
});