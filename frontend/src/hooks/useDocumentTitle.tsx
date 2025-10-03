import { useEffect } from 'preact/hooks';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} - whoAsr`;
    return () => {
      document.title = 'whoAsr - 智能语音识别平台';
    };
  }, [title]);
}