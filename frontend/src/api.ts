/**
 * API 接口定义
 * 与后端 FunASR API 服务器通信
 */

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// WebSocket 消息类型
export interface WebSocketMessage {
    type: string;
    [key: string]: any;
}

// 开始录制消息
export interface StartRecordingMessage extends WebSocketMessage {
    type: 'start_recording';
}

// 停止录制消息
export interface StopRecordingMessage extends WebSocketMessage {
    type: 'stop_recording';
}

// 音频块消息
export interface AudioChunkMessage extends WebSocketMessage {
    type: 'audio_chunk';
    data: string;
}

// 语音识别结果消息
export interface RecognitionResultMessage extends WebSocketMessage {
    type: 'recognition_result';
    text: string;
    is_final: boolean;
}

// 状态消息
export interface StatusMessage extends WebSocketMessage {
    type: 'status';
    message: string;
}

// 错误消息
export interface ErrorMessage extends WebSocketMessage {
    type: 'error';
    message: string;
}

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
    model_loaded: boolean;
}

// 标点模型状态响应
export interface PunctuationStatusResponse {
    model_loaded: boolean;
    model_name: string;
}

// 标点模型加载响应
export interface PunctuationLoadResponse {
    success: boolean;
    message: string;
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
            const response = await fetch(`${this.baseUrl}/health`);
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
            const response = await fetch(`${this.baseUrl}/punctuation/add`, {
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

    // 获取标点模型状态
    async getPunctuationStatus(): Promise<PunctuationStatusResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/punctuation/status`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('获取标点模型状态失败:', error);
            throw error;
        }
    }

    // 加载标点模型
    async loadPunctuationModel(): Promise<PunctuationLoadResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/punctuation/load`, {
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
            console.error('加载标点模型失败:', error);
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
export function isValidWebSocketMessage(message: any): message is WebSocketMessage {
    return message && typeof message === 'object' && typeof message.type === 'string';
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
