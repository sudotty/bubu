import type { File, FileGroups } from '../types';

export const formatFileSize = (bytes: number): string => {
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};



export const groupFilesByDate = (
  files: File[],
  excludeFavorites: boolean = false,
  favorites: Set<number> = new Set()
): FileGroups => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const filteredFiles = excludeFavorites
    ? files.filter(f => !favorites.has(f.id))
    : files;

  return {
    today: filteredFiles.filter(f => new Date(f.upload_time) >= today),
    yesterday: filteredFiles.filter(
      f => new Date(f.upload_time) >= yesterday && new Date(f.upload_time) < today
    ),
    thisWeek: filteredFiles.filter(
      f => new Date(f.upload_time) >= thisWeek && new Date(f.upload_time) < yesterday
    ),
    thisMonth: filteredFiles.filter(
      f => new Date(f.upload_time) >= thisMonth && new Date(f.upload_time) < thisWeek
    ),
    older: filteredFiles.filter(f => new Date(f.upload_time) < thisMonth)
  };
};

export const sortFilesByFavorites = (files: File[], favorites: Set<number>): File[] => {
  return files.sort((a, b) => {
    const aIsFavorite = favorites.has(a.id);
    const bIsFavorite = favorites.has(b.id);
    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;
    return 0;
  });
};