/**
 * 类名值类型
 */
export type ClassValue = 
  | string 
  | number 
  | boolean 
  | undefined 
  | null 
  | ClassValue[] 
  | Record<string, boolean | undefined | null>;

/**
 * 合并类名的简化实现
 * 
 * @param inputs - 类名输入，支持字符串、对象、数组等
 * @returns 合并后的类名字符串
 * 
 * @example
 * ```ts
 * // 基础用法
 * cn('px-2 py-1', 'text-sm') // 'px-2 py-1 text-sm'
 * 
 * // 条件类名
 * cn('base-class', {
 *   'active-class': isActive,
 *   'disabled-class': isDisabled
 * })
 * 
 * // 数组形式
 * cn(['px-2', 'py-1'], 'text-sm') // 'px-2 py-1 text-sm'
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  
  for (const input of inputs) {
    if (!input) continue;
    
    if (typeof input === 'string') {
      classes.push(input);
    } else if (typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) classes.push(nested);
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }
  
  return classes.join(' ');
}

/**
 * 创建变体样式映射的辅助函数
 * 
 * @param variants - 变体样式映射对象
 * @param defaultVariant - 默认变体
 * @returns 变体样式函数
 * 
 * @example
 * ```ts
 * const buttonVariants = createVariants({
 *   variant: {
 *     primary: 'bg-blue-500 text-white',
 *     secondary: 'bg-gray-500 text-white'
 *   },
 *   size: {
 *     sm: 'px-2 py-1 text-sm',
 *     lg: 'px-4 py-2 text-lg'
 *   }
 * }, {
 *   variant: 'primary',
 *   size: 'sm'
 * });
 * 
 * buttonVariants({ variant: 'secondary', size: 'lg' })
 * ```
 */
export function createVariants<T extends Record<string, Record<string, string>>>(
  variants: T,
  defaultVariants: { [K in keyof T]: keyof T[K] }
) {
  return function getVariantClasses(
    props: Partial<{ [K in keyof T]: keyof T[K] }> = {}
  ): string {
    const classes: string[] = [];
    
    for (const [key, variantMap] of Object.entries(variants)) {
      const variant = props[key as keyof T] || defaultVariants[key as keyof T];
      if (variant && variantMap[variant as string]) {
        classes.push(variantMap[variant as string]);
      }
    }
    
    return classes.join(' ');
  };
}

/**
 * 条件性应用类名的辅助函数
 * 
 * @param condition - 条件
 * @param trueClasses - 条件为真时的类名
 * @param falseClasses - 条件为假时的类名
 * @returns 类名字符串
 * 
 * @example
 * ```ts
 * conditionalClass(isActive, 'bg-blue-500', 'bg-gray-500')
 * conditionalClass(isLoading, 'opacity-50 cursor-not-allowed')
 * ```
 */
export function conditionalClass(
  condition: boolean,
  trueClasses: string,
  falseClasses: string = ''
): string {
  return condition ? trueClasses : falseClasses;
}

/**
 * 响应式类名辅助函数
 * 
 * @param base - 基础类名
 * @param responsive - 响应式类名映射
 * @returns 合并后的响应式类名
 * 
 * @example
 * ```ts
 * responsive('text-sm', {
 *   md: 'md:text-base',
 *   lg: 'lg:text-lg',
 *   xl: 'xl:text-xl'
 * }) // 'text-sm md:text-base lg:text-lg xl:text-xl'
 * ```
 */
export function responsive(
  base: string,
  responsive: Partial<Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', string>>
): string {
  const classes = [base];
  
  Object.entries(responsive).forEach(([breakpoint, className]) => {
    if (className) {
      classes.push(className);
    }
  });
  
  return classes.join(' ');
}

/**
 * 焦点样式辅助函数
 * 
 * @param options - 焦点样式选项
 * @returns 焦点相关的类名
 * 
 * @example
 * ```ts
 * focusStyles() // 默认焦点样式
 * focusStyles({ ring: 'ring-blue-500', offset: true })
 * ```
 */
export function focusStyles(options: {
  ring?: string;
  offset?: boolean;
  visible?: boolean;
} = {}): string {
  const {
    ring = 'ring-blue-500',
    offset = true,
    visible = true
  } = options;
  
  return cn(
    'focus:outline-none',
    visible && 'focus:ring-2',
    visible && ring,
    visible && offset && 'focus:ring-offset-2'
  );
}

/**
 * 过渡动画辅助函数
 * 
 * @param properties - 过渡属性
 * @param duration - 持续时间
 * @param easing - 缓动函数
 * @returns 过渡相关的类名
 * 
 * @example
 * ```ts
 * transition() // 默认过渡
 * transition(['colors', 'transform'], 'duration-300', 'ease-in-out')
 * ```
 */
export function transition(
  properties: string[] = ['colors'],
  duration: string = 'duration-200',
  easing: string = 'ease-in-out'
): string {
  const transitionProperty = properties.length === 1 && properties[0] === 'colors'
    ? 'transition-colors'
    : properties.length === 1 && properties[0] === 'all'
    ? 'transition-all'
    : `transition-[${properties.join(',')}]`;
    
  return cn(transitionProperty, duration, easing);
}

export default cn;