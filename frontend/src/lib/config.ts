/**
 * 统一的API配置
 * 遵循KISS原则：单一职责，所有API配置集中管理
 */

// API 基础配置
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// API 端点常量
export const API_ENDPOINTS = {
  // 模型管理
  MODEL_STATUS: '/model/status',
  MODEL_LOAD: '/model/load',
  MODEL_UNLOAD: (modelType: string) => `/model/unload/${modelType}`,

  // 健康检查
  HEALTH: '/health',

  // 标点符号
  PUNCTUATION_ADD: '/punctuation/add',

  // 离线识别
  OFFLINE_UPLOAD: '/offline/upload',
  OFFLINE_RECOGNIZE: '/offline/recognize',

  // VAD
  VAD_UPLOAD_AND_DETECT: '/vad/upload_and_detect',
  VAD_DETECT: '/vad/detect',

  // 时间戳
  TIMESTAMP_UPLOAD: '/timestamp/upload',
  TIMESTAMP_PREDICT: '/timestamp/predict',
  TIMESTAMP_UPLOAD_AND_PREDICT: '/timestamp/upload_and_predict',
} as const;

// 通用API请求配置
export const API_CONFIG = {
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30秒超时
} as const;