import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../../utils/ui/classNames';

/**
 * 懒加载组件
 * 支持图片、组件和内容的懒加载
 * 使用 Intersection Observer API 实现高性能监听
 */

export interface LazyLoadProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 占位符内容 */
  placeholder?: React.ReactNode;
  /** 根边距，用于提前触发加载 */
  rootMargin?: string;
  /** 触发阈值 */
  threshold?: number;
  /** 是否只加载一次 */
  once?: boolean;
  /** 加载延迟（毫秒） */
  delay?: number;
  /** 自定义类名 */
  className?: string;
  /** 加载完成回调 */
  onLoad?: () => void;
  /** 进入视口回调 */
  onIntersect?: (isIntersecting: boolean) => void;
}

/**
 * 默认占位符组件
 */
const DefaultPlaceholder: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn(
      'flex items-center justify-center bg-base-200 animate-pulse',
      'min-h-[200px] rounded-lg',
      className
    )}>
      <div className="flex flex-col items-center space-y-2">
        <div className="w-8 h-8 bg-base-300 rounded-full animate-pulse"></div>
        <div className="text-sm text-base-content/50">加载中...</div>
      </div>
    </div>
  );
};

export const LazyLoad: React.FC<LazyLoadProps> = ({
  children,
  placeholder,
  rootMargin = '50px',
  threshold = 0.1,
  once = true,
  delay = 0,
  className,
  onLoad,
  onIntersect
}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    const isCurrentlyIntersecting = entry.isIntersecting;
    
    onIntersect?.(isCurrentlyIntersecting);
    
    if (isCurrentlyIntersecting && !hasLoaded) {
      if (delay > 0) {
        timeoutRef.current = setTimeout(() => {
          setIsIntersecting(true);
          if (once) {
            setHasLoaded(true);
          }
          onLoad?.();
        }, delay);
      } else {
        setIsIntersecting(true);
        if (once) {
          setHasLoaded(true);
        }
        onLoad?.();
      }
    } else if (!isCurrentlyIntersecting && !once) {
      setIsIntersecting(false);
    }
  }, [hasLoaded, once, delay, onLoad, onIntersect]);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold
    });
    
    observer.observe(element);
    
    return () => {
      observer.unobserve(element);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleIntersection, rootMargin, threshold]);
  
  const shouldShowContent = isIntersecting || hasLoaded;
  
  return (
    <div ref={elementRef} className={className}>
      {shouldShowContent ? (
        children
      ) : (
        placeholder || <DefaultPlaceholder className={className} />
      )}
    </div>
  );
};

/**
 * 懒加载图片组件
 */
export interface LazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** 图片源 */
  src: string;
  /** 占位符图片 */
  placeholder?: string;
  /** 根边距 */
  rootMargin?: string;
  /** 触发阈值 */
  threshold?: number;
  /** 加载完成回调 */
  onLoad?: () => void;
  /** 加载错误回调 */
  onError?: () => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  placeholder,
  rootMargin = '50px',
  threshold = 0.1,
  onLoad,
  onError,
  className,
  alt = '',
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string | undefined>(placeholder);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const handleLazyLoad = useCallback(() => {
    const img = new Image();
    
    img.onload = () => {
      setImageSrc(src);
      setImageLoaded(true);
      onLoad?.();
    };
    
    img.onerror = () => {
      setImageError(true);
      onError?.();
    };
    
    img.src = src;
  }, [src, onLoad, onError]);
  
  if (imageError) {
    return (
      <div className={cn(
        'flex items-center justify-center bg-base-200 text-base-content/50',
        'min-h-[200px] rounded-lg',
        className
      )}>
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }
  
  return (
    <LazyLoad
      rootMargin={rootMargin}
      threshold={threshold}
      onLoad={handleLazyLoad}
      className={className}
      placeholder={
        <div className={cn(
          'flex items-center justify-center bg-base-200 animate-pulse',
          'min-h-[200px] rounded-lg',
          className
        )}>
          <svg className="w-8 h-8 text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      }
    >
      <img
        src={imageSrc}
        alt={alt}
        className={cn(
          'transition-opacity duration-300',
          imageLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
        {...props}
      />
    </LazyLoad>
  );
};

/**
 * 懒加载组件容器
 */
export interface LazyComponentProps {
  /** 组件加载函数 */
  loader: () => Promise<{ default: React.ComponentType<any> }>;
  /** 组件属性 */
  props?: Record<string, any>;
  /** 加载中占位符 */
  fallback?: React.ReactNode;
  /** 错误占位符 */
  errorFallback?: React.ReactNode;
  /** 根边距 */
  rootMargin?: string;
  /** 触发阈值 */
  threshold?: number;
  /** 自定义类名 */
  className?: string;
}

export const LazyComponent: React.FC<LazyComponentProps> = ({
  loader,
  props = {},
  fallback,
  errorFallback,
  rootMargin = '50px',
  threshold = 0.1,
  className
}) => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const loadComponent = useCallback(async () => {
    if (Component || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const module = await loader();
      setComponent(() => module.default);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [loader, Component, loading]);
  
  if (error) {
    return (
      <div className={className}>
        {errorFallback || (
          <div className="flex items-center justify-center p-8 text-error">
            <span>组件加载失败</span>
          </div>
        )}
      </div>
    );
  }
  
  if (Component) {
    return (
      <div className={className}>
        <Component {...props} />
      </div>
    );
  }
  
  return (
    <LazyLoad
      rootMargin={rootMargin}
      threshold={threshold}
      onLoad={loadComponent}
      className={className}
      placeholder={fallback || <DefaultPlaceholder className={className} />}
    >
      {loading && (
        fallback || <DefaultPlaceholder className={className} />
      )}
    </LazyLoad>
  );
};

export default LazyLoad;