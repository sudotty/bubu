import type { StateCreator } from 'zustand';

// FilePanel 组件状态接口
export interface FilePanelState {
  // 本地刷新状态
  localIsRefreshing: boolean;
}

// FilePanel 组件动作接口
export interface FilePanelActions {
  // 设置本地刷新状态
  setLocalIsRefreshing: (isRefreshing: boolean) => void;
  // 开始本地刷新
  startLocalRefresh: () => void;
  // 结束本地刷新
  endLocalRefresh: () => void;
}

// FilePanel slice 类型定义
export type FilePanelSlice = FilePanelState & FilePanelActions;

// 创建 FilePanel slice
export const createFilePanelSlice: StateCreator<
  FilePanelSlice,
  [],
  [],
  FilePanelSlice
> = (set) => ({
  // 初始状态
  localIsRefreshing: false,

  // 动作实现
  setLocalIsRefreshing: (isRefreshing: boolean) => {
    set({ localIsRefreshing: isRefreshing });
  },

  startLocalRefresh: () => {
    set({ localIsRefreshing: true });
  },

  endLocalRefresh: () => {
    set({ localIsRefreshing: false });
  },
});