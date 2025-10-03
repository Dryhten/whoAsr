/**
 * 通用的页面状态管理Hook
 * 遵循KISS原则：简化重复的状态逻辑
 */

import { useState } from 'preact/hooks';

export interface PageState<T = any> {
  data: T | null;
  isLoading: boolean;
  error: string;
}

export function usePageState<T = any>(initialData: T | null = null) {
  const [state, setState] = useState<PageState<T>>({
    data: initialData,
    isLoading: false,
    error: '',
  });

  const setLoading = (loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  };

  const setError = (error: string) => {
    setState(prev => ({ ...prev, error, isLoading: false }));
  };

  const setData = (data: T) => {
    setState(prev => ({ ...prev, data, error: '', isLoading: false }));
  };

  const reset = () => {
    setState({
      data: initialData,
      isLoading: false,
      error: '',
    });
  };

  return {
    ...state,
    setLoading,
    setError,
    setData,
    reset,
  };
}