import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  showNativeNotification: (title: string, message: string, options?: NotificationOptions) => globalThis.Notification | null;
  nativeNotificationPermission: NotificationPermission;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nativeNotificationPermission, setNativeNotificationPermission] = useState<NotificationPermission>('default');

  // 请求原生通知权限
  useEffect(() => {
    if ('Notification' in window) {
      if (globalThis.Notification.permission === 'default') {
        globalThis.Notification.requestPermission().then(permission => {
          setNativeNotificationPermission(permission);
        });
      } else {
        setNativeNotificationPermission(globalThis.Notification.permission);
      }
    }
  }, []);

  // 监听后端通知事件
  useEffect(() => {
    const unsubscribe = EventsOn('show-notification', (data: { title: string; message: string }) => {
      showNativeNotification(data.title, data.message);
      // 同时显示应用内通知
      addNotification({
        type: 'info',
        title: data.title,
        message: data.message,
        duration: 5000
      });
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // 显示原生系统通知
  const showNativeNotification = useCallback((title: string, message: string, options?: NotificationOptions): globalThis.Notification | null => {
    if ('Notification' in window && nativeNotificationPermission === 'granted') {
      const notification = new globalThis.Notification(title, {
        body: message,
        icon: '/appicon.png', // 应用图标
        badge: '/appicon.png',
        tag: 'bubu-bi-notification',
        requireInteraction: false,
        silent: false,
        ...options
      });

      // 点击通知时聚焦窗口
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // 自动关闭通知
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    }
    return null;
  }, [nativeNotificationPermission]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    const newNotification = {
      ...notification,
      id,
      duration: notification.duration || 3000,
    };

    setNotifications(prev => [...prev, newNotification]);

    // 显示原生通知（如果是重要通知）
    if (notification.type === 'error' || notification.type === 'success') {
      showNativeNotification(
        notification.title,
        notification.message || '',
        {
          icon: notification.type === 'error' ? '/error-icon.png' : '/success-icon.png'
        }
      );
    }

    // 自动移除通知（除非是持久化的）
    if (!newNotification.persistent && newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, [showNativeNotification]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    showNativeNotification,
    nativeNotificationPermission,
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  };

  const getAlertClass = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'alert-success';
      case 'error': return 'alert-error';
      case 'warning': return 'alert-warning';
      case 'info': return 'alert-info';
      default: return 'alert-info';
    }
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {/* 通知显示区域 */}
      <div className="toast toast-top toast-end z-50">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`alert ${
              notification.type === 'success' ? 'alert-success' :
              notification.type === 'error' ? 'alert-error' :
              notification.type === 'warning' ? 'alert-warning' :
              'alert-info'
            } shadow-lg animate-in slide-in-from-right-full duration-300 text-fluid-sm`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0">
                {notification.type === 'success' && <span className="text-fluid-lg">✅</span>}
                {notification.type === 'error' && <span className="text-fluid-lg">❌</span>}
                {notification.type === 'warning' && <span className="text-fluid-lg">⚠️</span>}
                {notification.type === 'info' && <span className="text-fluid-lg">ℹ️</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-fluid-sm">{notification.title}</div>
                {notification.message && (
                  <div className="text-fluid-xs opacity-90 mt-1">{notification.message}</div>
                )}
              </div>
              {!notification.persistent && (
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="btn btn-ghost btn-xs opacity-60 hover:opacity-100 text-fluid-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

// 便捷的通知方法
export const useNotificationMethods = () => {
  const { addNotification } = useNotification();

  const success = useCallback((title: string, message?: string, options?: Partial<Notification>) => 
    addNotification({ type: 'success', title, message, ...options }), [addNotification]);
    
  const error = useCallback((title: string, message?: string, options?: Partial<Notification>) => 
    addNotification({ type: 'error', title, message, ...options }), [addNotification]);
    
  const warning = useCallback((title: string, message?: string, options?: Partial<Notification>) => 
    addNotification({ type: 'warning', title, message, ...options }), [addNotification]);
    
  const info = useCallback((title: string, message?: string, options?: Partial<Notification>) => 
    addNotification({ type: 'info', title, message, ...options }), [addNotification]);

  return {
    success,
    error,
    warning,
    info,
  };
};