/**
 * 统一的API配置
 * 遵循KISS原则：单一职责，所有API配置集中管理
 */

// API 基础配置
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// API 端点常量
export const API_ENDPOINTS = {
  // 模型管理
  MODEL_INFO: '/model/info',
  MODEL_LOAD: '/model/load',
  MODEL_UNLOAD: (modelType: string) => `/model/unload/${modelType}`,
  MODEL_CONFIG: (modelType: string) => `/model/config/${modelType}`,

  // 健康检查
  HEALTH: '/health',

  // 简化的功能接口
  RECOGNIZE: '/recognize',        // 离线语音识别
  PUNCTUATE: '/punctuate',        // 标点符号添加
  VAD: '/vad',                   // 语音活动检测
  TIMESTAMP: '/timestamp',       // 时间戳预测
} as const;

// 通用API请求配置
export const API_CONFIG = {
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30秒超时
} as const;