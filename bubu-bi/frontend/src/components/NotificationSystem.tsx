import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

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

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    const newNotification = {
      ...notification,
      id,
      duration: notification.duration || 3000,
    };

    setNotifications(prev => [...prev, newNotification]);

    // 自动移除通知（除非是持久化的）
    if (!newNotification.persistent && newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

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
            } shadow-lg animate-in slide-in-from-right-full duration-300`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0">
                {notification.type === 'success' && <span className="text-lg">✅</span>}
                {notification.type === 'error' && <span className="text-lg">❌</span>}
                {notification.type === 'warning' && <span className="text-lg">⚠️</span>}
                {notification.type === 'info' && <span className="text-lg">ℹ️</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{notification.title}</div>
                {notification.message && (
                  <div className="text-xs opacity-90 mt-1">{notification.message}</div>
                )}
              </div>
              {!notification.persistent && (
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="btn btn-ghost btn-xs opacity-60 hover:opacity-100"
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