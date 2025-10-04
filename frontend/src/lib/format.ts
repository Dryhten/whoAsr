/**
 * 统一的格式化工具函数库
 * 遵循 KISS 原则：简单、可复用、无副作用
 */

// 文件大小格式化
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// 时间格式化（毫秒转可读格式）
export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const milliseconds = ms % 1000;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  } else {
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
  }
};

// 时间格式化（毫秒转秒，保留2位小数）
export const formatDurationSeconds = (ms: number): string => {
  return (ms / 1000).toFixed(2) + "秒";
};

// VAD 片段格式化
export const formatVADSegments = (segments: number[][]): string[] => {
  return segments.map((segment, index) => {
    if (Array.isArray(segment) && segment.length >= 2) {
      const [start, end] = segment;
      if (typeof start === 'number' && typeof end === 'number') {
        const duration = formatDurationSeconds(end - start);
        return `片段 ${index + 1}: ${start}ms - ${end}ms (时长: ${duration})`;
      }
    }
    return `片段 ${index + 1}: ${JSON.stringify(segment)}`;
  });
};

// 时间戳片段格式化
export const formatTimestampSegments = (segments: Array<{
  text?: string;
  start?: number;
  end?: number;
  timestamp?: number[][];
  confidence?: number;
  speaker?: string;
}>): string[] => {
  return segments.map((segment, index) => {
    if (segment && typeof segment === 'object' && 'text' in segment) {
      const start = segment.start || 0;
      const end = segment.end || 0;
      const duration = formatDurationSeconds(end - start);
      return `${index + 1}. [${start}ms - ${end}ms] (${duration}) ${segment.text}`;
    }
    return `${index + 1}. ${JSON.stringify(segment)}`;
  });
};

// 计算总时长
export const calculateTotalDuration = (segments: number[][]): number => {
  if (segments.length === 0) return 0;
  return Math.max(...segments.map(segment =>
    Array.isArray(segment) && segment.length >= 2 ? segment[1] || 0 : 0
  ));
};

// 语音识别结果格式化
export const formatASRResult = (text: string, confidence?: number): string => {
  if (confidence !== undefined) {
    return `${text} (置信度: ${(confidence * 100).toFixed(1)}%)`;
  }
  return text;
};

// 错误消息格式化
export const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
};