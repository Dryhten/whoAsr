/**
 * API 接口定义
 * 与后端 FunASR API 服务器通信
 */

import { API_BASE_URL, API_ENDPOINTS } from '@/lib/config';

// WebSocket 基础消息类型
export interface BaseWebSocketMessage {
    type: string;
}

// 开始录制消息
export interface StartRecordingMessage extends BaseWebSocketMessage {
    type: 'start_recording';
}

// 停止录制消息
export interface StopRecordingMessage extends BaseWebSocketMessage {
    type: 'stop_recording';
}

// 音频块消息
export interface AudioChunkMessage extends BaseWebSocketMessage {
    type: 'audio_chunk';
    data: string;
}

// 语音识别结果消息
export interface RecognitionResultMessage extends BaseWebSocketMessage {
    type: 'recognition_result';
    text: string;
    is_final: boolean;
}

// 状态消息
export interface StatusMessage extends BaseWebSocketMessage {
    type: 'status';
    message: string;
}

// 错误消息
export interface ErrorMessage extends BaseWebSocketMessage {
    type: 'error';
    message: string;
}

// 联合类型表示所有可能的WebSocket消息
export type WebSocketMessage =
    | StartRecordingMessage
    | StopRecordingMessage
    | AudioChunkMessage
    | RecognitionResultMessage
    | StatusMessage
    | ErrorMessage;

// 标点添加请求
export interface PunctuationRequest {
    text: string;
    force_load?: boolean;
}

// 标点添加响应
export interface PunctuationResponse {
    original_text: string;
    punctuated_text: string;
    success: boolean;
    message?: string;
}

// 健康检查响应
export interface HealthCheckResponse {
    status: string;
    timestamp: string;
    services: {
        [key: string]: {
            loaded: boolean;
            display_name: string;
            description: string;
            auto_load: boolean;
            supported_formats: string[];
            api_endpoints: string[];
        };
    };
    total_loaded: number;
    system: {
        memory_total_gb: number;
        memory_available_gb: number;
        memory_usage_percent: number;
        cpu_usage_percent: number;
    };
    api_info: {
        version: string;
        title: string;
        docs: string;
        websocket: string;
    };
}

// 模型配置接口
export interface ModelConfig {
    sample_rate?: number;
    chunk_size?: number[];
    encoder_chunk_look_back?: number;
    decoder_chunk_look_back?: number;
    batch_size_threshold?: number;
    [key: string]: unknown;
}

// 模型信息响应
export interface ModelInfoResponse {
    models: {
        [key: string]: {
            loaded: boolean;
            display_name: string;
            description: string;
            model_name?: string;
            auto_load?: boolean;
            config?: ModelConfig;
        };
    };
    total_loaded: number;
    available_models: {
        [key: string]: {
            display_name: string;
            description: string;
            model_name: string;
            auto_load: boolean;
            dependencies: string[];
            loaded: boolean;
            config: ModelConfig;
        };
    };
}

// WebSocket 连接类
export class SpeechRecognitionWebSocket {
    private ws: WebSocket | null = null;
    private clientId: string;
    private url: string;
    private onMessage: ((message: WebSocketMessage) => void) | null = null;
    private onOpen: (() => void) | null = null;
    private onClose: (() => void) | null = null;
    private onError: ((error: Event) => void) | null = null;

    constructor(clientId: string, baseUrl: string = API_BASE_URL) {
        this.clientId = clientId;
        this.url = `${baseUrl.replace('http', 'ws')}/ws/${clientId}`;
    }

    connect() {
        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('WebSocket 连接已建立');
                this.onOpen?.();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    this.onMessage?.(message);
                } catch (error) {
                    console.error('解析 WebSocket 消消息失败:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket 连接已关闭');
                this.onClose?.();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket 错误:', error);
                this.onError?.(error);
            };
        } catch (error) {
            console.error('创建 WebSocket 连接失败:', error);
            throw error;
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    sendMessage(message: WebSocketMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket 未连接，无法发送消息');
        }
    }

    startRecording() {
        this.sendMessage({ type: 'start_recording' });
    }

    stopRecording() {
        this.sendMessage({ type: 'stop_recording' });
    }

    sendAudioChunk(audioData: string) {
        this.sendMessage({
            type: 'audio_chunk',
            data: audioData
        });
    }

    // 事件监听器设置
    onMessageReceived(callback: (message: WebSocketMessage) => void) {
        this.onMessage = callback;
    }

    onConnectionOpen(callback: () => void) {
        this.onOpen = callback;
    }

    onConnectionClose(callback: () => void) {
        this.onClose = callback;
    }

    onConnectionError(callback: (error: Event) => void) {
        this.onError = callback;
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}

// HTTP API 类
export class SpeechApi {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    // 健康检查
    async healthCheck(): Promise<HealthCheckResponse> {
        try {
            const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.HEALTH}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('健康检查失败:', error);
            throw error;
        }
    }

    // 添加标点符号
    async addPunctuation(request: PunctuationRequest): Promise<PunctuationResponse> {
        try {
            const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.PUNCTUATE}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('添加标点失败:', error);
            throw error;
        }
    }

    // 获取模型信息
    async getModelInfo(): Promise<ModelInfoResponse> {
        try {
            const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.MODEL_INFO}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('获取模型信息失败:', error);
            throw error;
        }
    }

    // 加载模型
    async loadModel(modelType: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.MODEL_LOAD}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model_type: modelType }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('加载模型失败:', error);
            throw error;
        }
    }

    // 卸载模型
    async unloadModel(modelType: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.MODEL_UNLOAD(modelType)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('卸载模型失败:', error);
            throw error;
        }
    }
}

// 音频录制工具类
export class AudioRecorder {
    private stream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    private onDataAvailableCallback: ((float32Array: Float32Array) => void) | null = null;
    private onStopCallback: (() => void) | null = null;
    private onErrorCallback: ((error: Error) => void) | null = null;
    private isRecordingFlag: boolean = false;

    constructor() {
        this.isRecordingFlag = false;
    }

    async startRecording(): Promise<void> {
        try {
            // 获取麦克风权限
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,  // FunASR 使用 16kHz
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });

            // 创建音频上下文
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 16000
            });

            // 创建音频源
            this.source = this.audioContext.createMediaStreamSource(this.stream);

            // 创建处理器节点
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

            // 设置音频处理回调
            this.processor.onaudioprocess = (event) => {
                if (this.isRecordingFlag && this.onDataAvailableCallback) {
                    const inputBuffer = event.inputBuffer;
                    const float32Array = inputBuffer.getChannelData(0);
                    this.onDataAvailableCallback(float32Array);
                }
            };

            // 连接音频节点
            this.source.connect(this.processor);
            // ScriptProcessorNode需要连接到某个地方才会触发onaudioprocess事件
            this.processor.connect(this.audioContext.destination);

            this.isRecordingFlag = true;
            console.log('音频录制已开始 (原始PCM格式)');

        } catch (error) {
            console.error('启动音频录制失败:', error);
            this.cleanup();
            this.onErrorCallback?.(error as Error);
            throw error;
        }
    }

    stopRecording(): void {
        this.isRecordingFlag = false;
        this.cleanup();
        this.onStopCallback?.();
        console.log('音频录制已停止');
    }

    private cleanup(): void {
        // 断开音频节点连接
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }

        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }

        // 关闭音频上下文
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }

        // 停止音频流
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    // 事件监听器设置
    onDataAvailable(callback: (float32Array: Float32Array) => void) {
        this.onDataAvailableCallback = callback;
    }

    onStop(callback: () => void) {
        this.onStopCallback = callback;
    }

    onError(callback: (error: Error) => void) {
        this.onErrorCallback = callback;
    }

    isRecording(): boolean {
        return this.isRecordingFlag;
    }
}

// 音频转换工具类
export class AudioConverter {
    // 将 Blob 转换为 AudioBuffer
    static async blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
        return new Promise((resolve, reject) => {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const reader = new FileReader();

            reader.onload = async () => {
                try {
                    const arrayBuffer = reader.result as ArrayBuffer;
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    resolve(audioBuffer);
                } catch (error) {
                    reject(error);
                } finally {
                    audioContext.close();
                }
            };

            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }

    // 将 WebM/Opus 转换为 Float32Array
    static async webmToFloat32(webmBlob: Blob): Promise<Float32Array> {
        return new Promise((resolve, reject) => {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const reader = new FileReader();

            reader.onload = async () => {
                try {
                    const arrayBuffer = reader.result as ArrayBuffer;
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const float32Array = audioBuffer.getChannelData(0);

                    // 确保采样率为16kHz以匹配后端要求
                    if (audioBuffer.sampleRate !== 16000) {
                        console.warn(`音频采样率 ${audioBuffer.sampleRate}Hz 与期望的 16kHz 不匹配，可能影响识别效果`);
                    }

                    resolve(float32Array);
                } catch (error) {
                    reject(error);
                } finally {
                    audioContext.close();
                }
            };

            reader.onerror = reject;
            reader.readAsArrayBuffer(webmBlob);
        });
    }

    // 检测并标准化音频格式
    static async normalizeAudioFormat(blob: Blob): Promise<Float32Array> {
        try {
            // 首先尝试直接解码为 AudioBuffer
            const audioBuffer = await this.blobToAudioBuffer(blob);

            // 确保是单声道
            let channelData: Float32Array;
            if (audioBuffer.numberOfChannels > 1) {
                // 如果是多声道，混合为单声道
                channelData = this.mixToMono(audioBuffer);
            } else {
                channelData = audioBuffer.getChannelData(0);
            }

            // 重采样到 16kHz
            return await this.resampleTo16kHz({
                ...audioBuffer,
                getChannelData: () => channelData,
                numberOfChannels: 1,
                sampleRate: audioBuffer.sampleRate,
                duration: audioBuffer.duration,
                length: channelData.length
            } as AudioBuffer);

        } catch (error) {
            console.error('音频格式标准化失败:', error);
            throw new Error(`无法处理音频格式: ${error}`);
        }
    }

    // 将多声道混合为单声道
    static mixToMono(audioBuffer: AudioBuffer): Float32Array {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const monoData = new Float32Array(length);

        for (let i = 0; i < length; i++) {
            let sum = 0;
            for (let channel = 0; channel < numberOfChannels; channel++) {
                sum += audioBuffer.getChannelData(channel)[i];
            }
            monoData[i] = sum / numberOfChannels;
        }

        return monoData;
    }

    // 将 Float32Array 转换为 Base64
    static float32ToBase64(float32Array: Float32Array): string {
        const buffer = new ArrayBuffer(float32Array.length * 4);
        const view = new DataView(buffer);

        for (let i = 0; i < float32Array.length; i++) {
            view.setFloat32(i * 4, float32Array[i], true); // little-endian
        }

        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    // 将 Base64 转换为 Float32Array
    static base64ToFloat32(base64: string): Float32Array {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);

        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const buffer = bytes.buffer;
        return new Float32Array(buffer);
    }

    // 将音频Blob直接转换为Base64字符串（用于WebSocket传输）
    static async blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // 重采样音频到16kHz
    static async resampleTo16kHz(audioBuffer: AudioBuffer): Promise<Float32Array> {
        const sourceSampleRate = audioBuffer.sampleRate;
        const targetSampleRate = 16000;

        if (sourceSampleRate === targetSampleRate) {
            return audioBuffer.getChannelData(0);
        }

        const ratio = sourceSampleRate / targetSampleRate;
        const sourceData = audioBuffer.getChannelData(0);
        const targetLength = Math.floor(sourceData.length / ratio);
        const targetData = new Float32Array(targetLength);

        for (let i = 0; i < targetLength; i++) {
            const sourceIndex = i * ratio;
            const index0 = Math.floor(sourceIndex);
            const index1 = Math.min(index0 + 1, sourceData.length - 1);
            const fraction = sourceIndex - index0;

            // 线性插值
            targetData[i] = sourceData[index0] * (1 - fraction) + sourceData[index1] * fraction;
        }

        return targetData;
    }
}

// 导出默认实例
export const speechApi = new SpeechApi();
export const createWebSocketConnection = (clientId: string) => new SpeechRecognitionWebSocket(clientId);
export const createAudioRecorder = () => new AudioRecorder();

// WebSocket 消息类型常量
export const WebSocketMessageTypes = {
    START_RECORDING: 'start_recording',
    STOP_RECORDING: 'stop_recording',
    AUDIO_CHUNK: 'audio_chunk',
    RECOGNITION_RESULT: 'recognition_result',
    STATUS: 'status',
    ERROR: 'error',
} as const;

// 工具函数：生成客户端ID
export function generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 工具函数：验证WebSocket消息
export function isValidWebSocketMessage(message: unknown): message is WebSocketMessage {
    return message !== null && typeof message === 'object' && 'type' in message && typeof message.type === 'string';
}

// 工具函数：检查是否为识别结果消息
export function isRecognitionResultMessage(message: WebSocketMessage): message is RecognitionResultMessage {
    return message.type === 'recognition_result';
}

// 工具函数：检查是否为错误消息
export function isErrorMessage(message: WebSocketMessage): message is ErrorMessage {
    return message.type === 'error';
}

// 工具函数：检查是否为状态消息
export function isStatusMessage(message: WebSocketMessage): message is StatusMessage {
    return message.type === 'status';
}

// 工具函数：检查浏览器是否支持音频录制
export function checkAudioSupport(): { supported: boolean; error?: string } {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
            supported: false,
            error: 'Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Edge.',
        };
    }

    if (!window.AudioContext && !(window as any).webkitAudioContext) {
        return {
            supported: false,
            error: 'Your browser does not support Web Audio API. Please use a modern browser.',
        };
    }

    return { supported: true };
}

// ============ Offline Speech Recognition API ============

// Offline Recognition Types
export interface RecognitionRequest {
    file_path: string;
    batch_size_s?: number;
    batch_size_threshold_s?: number;
    hotword?: string;
}

export interface RecognitionResponse {
    success: boolean;
    results?: Array<{
        text?: string;
        timestamp?: number[][];
        confidence?: number;
        speaker?: string;
        [key: string]: unknown;
    }>;
    file_name?: string;
    file_size?: number;
    message?: string;
}

// Offline Recognition API class
export class RecognitionAPI {
    static async recognizeFile(
        file: File,
        batchSizeS: number = 300,
        batchSizeThresholdS: number = 60,
        hotword?: string
    ): Promise<RecognitionResponse> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('batch_size_s', batchSizeS.toString());
        formData.append('batch_size_threshold_s', batchSizeThresholdS.toString());
        if (hotword) {
            formData.append('hotword', hotword);
        }

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RECOGNIZE}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Recognition failed: ${response.status}`);
        }

        return response.json();
    }

    static validateAudioFile(file: File): boolean {
        const validTypes = [
            'audio/wav', 'audio/mp3', 'audio/mpeg',
            'audio/m4a', 'audio/flac', 'audio/ogg'
        ];
        const validExtensions = ['.wav', '.mp3', '.m4a', '.flac', '.ogg'];

        return validTypes.includes(file.type) ||
               validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }
}

// ============ VAD (Voice Activity Detection) API ============

// VAD Types
export type VADSegment = number[];  // [start, end] in ms, or [start] for start-only, [-1] for end
export type VADSegmentList = VADSegment[];  // List of segments

export interface VADResponse {
    success: boolean;
    message: string;
    segments?: VADSegmentList[];
    file_name?: string;
    file_size?: number;
}

export interface VADWebSocketMessage {
    type: string;
    segments?: VADSegmentList[];
    is_final?: boolean;
    message?: string;
}

// VAD WebSocket class
export class VADWebSocket {
    private ws: WebSocket | null = null;
    private clientId: string;
    private onMessage?: (message: VADWebSocketMessage) => void;
    private onOpen?: () => void;
    private onClose?: () => void;
    private onError?: (error: string) => void;

    constructor(clientId: string) {
        this.clientId = clientId;
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // In development, use direct connection to backend; in production use relative path
                let wsUrl: string;
                if (window.location.hostname === 'localhost' && window.location.port === '5173') {
                    // Development environment - connect directly to backend
                    wsUrl = `ws://localhost:8000/vad/ws/${this.clientId}`;
                } else {
                    // Production environment - use relative path
                    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    wsUrl = `${wsProtocol}//${window.location.host}/vad/ws/${this.clientId}`;
                }

                console.log('Connecting VAD WebSocket to:', wsUrl);
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    if (this.onOpen) this.onOpen();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message: VADWebSocketMessage = JSON.parse(event.data);
                        if (this.onMessage) this.onMessage(message);
                    } catch (error) {
                        console.error('Failed to parse VAD WebSocket message:', error);
                    }
                };

                this.ws.onclose = () => {
                    if (this.onClose) this.onClose();
                };

                this.ws.onerror = (error) => {
                    const errorMsg = `VAD WebSocket error: ${error}`;
                    console.error('VAD WebSocket error:', error);
                    if (this.onError) this.onError(errorMsg);
                    reject(new Error(errorMsg));
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    sendStartVAD() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: "start_vad" }));
        }
    }

    sendStopVAD() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: "stop_vad" }));
        }
    }

    sendAudioChunk(audioData: string) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: "audio_chunk",
                data: audioData
            }));
        }
    }

    sendPing() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: "ping" }));
        }
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    onMessageReceived(callback: (message: VADWebSocketMessage) => void) {
        this.onMessage = callback;
    }

    onConnectionOpen(callback: () => void) {
        this.onOpen = callback;
    }

    onConnectionClose(callback: () => void) {
        this.onClose = callback;
    }

    onConnectionError(callback: (error: string) => void) {
        this.onError = callback;
    }
}

// VAD API class
export class VADAPI {
    static async uploadAndDetect(file: File): Promise<VADResponse> {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.VAD}`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`VAD detection failed: ${response.status}`);
        }

        return response.json();
    }

    // 保留旧方法以确保兼容性
    static async uploadFile(file: File): Promise<VADResponse> {
        return this.uploadAndDetect(file);
    }

    static async detectVoiceActivity(filePath: string): Promise<VADResponse> {
        // 这个方法现在已弃用，因为我们合并了上传和检测功能
        throw new Error('detectVoiceActivity method is deprecated. Use uploadAndDetect instead.');
    }

    static formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const milliseconds = ms % 1000;

        if (minutes > 0) {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
        } else {
            return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
        }
    }
}

// ============ Timestamp API ============

// Timestamp Types
export interface TimestampSegment {
    text: string;
    start: number;
    end: number;
    confidence: number;
}

export interface TimestampResponse {
    success: boolean;
    message: string;
    results?: TimestampSegment[];
}

export interface TimestampUploadResponse {
    success: boolean;
    message: string;
    audio_file_path?: string;
    text_file_path?: string;
}

export interface TimestampRequest {
    audio_file_path: string;
    text_file_path?: string;
    text_content?: string;
}

// Timestamp API class
export class TimestampAPI {
    static async uploadAndPredict(
        audioFile: File,
        textFile?: File,
        textContent?: string
    ): Promise<TimestampResponse> {
        const formData = new FormData();
        formData.append("audio_file", audioFile);

        if (textFile) {
            formData.append("text_file", textFile);
        }

        if (textContent) {
            formData.append("text_content", textContent);
        }

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TIMESTAMP}`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Timestamp prediction failed: ${response.status}`);
        }

        return response.json();
    }

    // 保留旧方法以确保兼容性
    static async uploadFiles(
        audioFile: File,
        textFile?: File,
        textContent?: string
    ): Promise<TimestampUploadResponse> {
        // 这个方法现在已弃用，因为我们合并了上传和预测功能
        const response = await this.uploadAndPredict(audioFile, textFile, textContent);
        return {
            success: response.success,
            message: response.message,
            audio_file_path: undefined, // 不再返回路径信息
            text_file_path: undefined,
        };
    }

    static async predictTimestamps(request: TimestampRequest): Promise<TimestampResponse> {
        // 这个方法现在已弃用，因为我们合并了上传和预测功能
        throw new Error('predictTimestamps method is deprecated. Use uploadAndPredict instead.');
    }

    static formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const milliseconds = ms % 1000;

        if (minutes > 0) {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
        } else {
            return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
        }
    }

    static formatTime(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes > 0) {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        } else {
            return `0:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }

    static validateTextFile(file: File): boolean {
        const validTypes = ['text/plain', 'text/html', 'text/css', 'text/javascript', 'application/json'];
        const validExtensions = ['.txt', '.text', '.md', '.json', '.html', '.css', '.js'];

        return validTypes.includes(file.type) ||
               validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    static validateAudioFile(file: File): boolean {
        const validTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/flac', 'audio/ogg'];
        const validExtensions = ['.wav', '.mp3', '.m4a', '.flac', '.ogg'];

        return validTypes.includes(file.type) ||
               validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    static readFileAsText(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve(e.target?.result as string);
            };
            reader.onerror = (e) => {
                reject(new Error(`Failed to read file: ${e}`));
            };
            reader.readAsText(file, 'UTF-8');
        });
    }
}

