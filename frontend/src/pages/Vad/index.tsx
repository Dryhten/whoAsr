import { useState, useEffect, useRef } from "preact/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ModelManagementCard } from "@/components/ModelManagementCard";
import {
  VADAPI,
  VADResponse,
  VADSegmentList,
  VADWebSocket,
  RealtimeNanoWebSocket,
  AudioRecorder,
  AudioConverter,
  generateClientId,
} from "../../api";
import { FileUploader, ResultDisplay } from "@/components/common";
import { formatFileSize, formatErrorMessage } from "@/lib/format";
import { useLocation } from "preact-iso";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ErrorIcon, StopIcon, MicrophoneIcon } from "@/components/icons";

type ParseSegmentResult =
  | { ok: true; start: number; end: number }
  | { ok: false; reason: string };

/** 从任意 segment 解析 [start, end]，失败时返回具体原因 */
function parseSegment(seg: unknown): ParseSegmentResult {
  if (seg == null) return { ok: false, reason: "值为 null 或 undefined" };
  if (typeof seg !== "object") return { ok: false, reason: `类型错误: 期望数组或对象，实际为 ${typeof seg}` };
  const raw = seg as Record<number, unknown>;
  const v0 = raw[0];
  const v1 = raw[1];
  if (v0 === undefined && v1 === undefined) return { ok: false, reason: "缺少起止时间（无 [0]、[1] 或 start、end）" };
  const start = Number(v0);
  const end = Number(v1);
  if (Number.isNaN(start)) return { ok: false, reason: `起始时间非数字: ${JSON.stringify(v0)}` };
  if (Number.isNaN(end)) return { ok: false, reason: `结束时间非数字: ${JSON.stringify(v1)}` };
  if (end <= start) return { ok: false, reason: `结束时间(${end}) 需大于起始时间(${start})` };
  return { ok: true, start, end };
}

/** 保证可迭代为数组（兼容类数组） */
function toSegmentList(segments: VADSegmentList): unknown[] {
  if (segments == null || typeof segments !== "object") return [];
  return Array.isArray(segments) ? segments : Array.from(segments as ArrayLike<unknown>);
}

/** 流式 VAD raw 格式：raw 为 [{ key, value: [[start,end],...] }]，[start,-1]=语音开始，[-1,end]=语音结束 */
export type StreamVadState = {
  completed: { start: number; end: number }[];
  pendingStart: number | null;
};

function parseStreamVadRaw(
  raw: unknown,
  prev: StreamVadState
): StreamVadState {
  const completed = [...prev.completed];
  let pendingStart = prev.pendingStart;
  const items = Array.isArray(raw) ? raw : [];
  for (const item of items) {
    if (item && typeof item === "object" && "value" in item) {
      const value = (item as { value: unknown }).value;
      const segments = Array.isArray(value) ? value : [];
      for (const seg of segments) {
        if (Array.isArray(seg) && seg.length >= 2) {
          const a = Number(seg[0]);
          const b = Number(seg[1]);
          if (a >= 0 && b === -1) pendingStart = a;
          else if (a === -1 && b >= 0 && pendingStart !== null) {
            completed.push({ start: pendingStart, end: b });
            pendingStart = null;
          }
        }
      }
    }
  }
  return { completed, pendingStart };
}

/** 根据语音片段计算静音区间 */
function computeSilenceSegments(
  speech: { start: number; end: number }[],
  maxEnd: number
): { start: number; end: number }[] {
  const silences: { start: number; end: number }[] = [];
  if (speech.length === 0) return silences;
  const first = speech[0];
  if (first.start > 0) silences.push({ start: 0, end: first.start });
  for (let i = 0; i < speech.length - 1; i++) {
    const gapStart = speech[i].end;
    const gapEnd = speech[i + 1].start;
    if (gapEnd > gapStart) silences.push({ start: gapStart, end: gapEnd });
  }
  const last = speech[speech.length - 1];
  if (last.end < maxEnd) silences.push({ start: last.end, end: maxEnd });
  return silences;
}

export function Vad() {
  const { url } = useLocation();
  const pageTitle =
    url === "/vad-offline"
      ? "离线语音活动检测"
      : url === "/vad-realtime"
        ? "实时语音活动检测"
        : "实时识别 (FunASR-Nano)";
  useDocumentTitle(pageTitle);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [results, setResults] = useState<VADSegmentList>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [streamSegments, setStreamSegments] = useState<StreamVadState>({
    completed: [],
    pendingStart: null,
  });
  const [isStreamConnected, setIsStreamConnected] = useState(false);
  const [isStreamRecording, setIsStreamRecording] = useState(false);
  const [streamStatus, setStreamStatus] = useState("准备就绪");
  const [streamError, setStreamError] = useState("");

  const vadWsRef = useRef<VADWebSocket | null>(null);
  const streamRecorderRef = useRef<AudioRecorder | null>(null);
  const clientIdRef = useRef<string>("");

  const [nanoResult, setNanoResult] = useState("");
  const [nanoStreamSegments, setNanoStreamSegments] = useState<StreamVadState>({
    completed: [],
    pendingStart: null,
  });
  const [nanoConnected, setNanoConnected] = useState(false);
  const [nanoRecording, setNanoRecording] = useState(false);
  const [nanoStatus, setNanoStatus] = useState("准备就绪");
  const [nanoError, setNanoError] = useState("");
  const nanoWsRef = useRef<RealtimeNanoWebSocket | null>(null);
  const nanoRecorderRef = useRef<AudioRecorder | null>(null);
  const nanoClientIdRef = useRef<string>("");

  const selectedFile = selectedFiles[0] || null;

  useEffect(() => {
    clientIdRef.current = generateClientId();
    vadWsRef.current = new VADWebSocket(clientIdRef.current);

    vadWsRef.current.onConnectionOpen(() => {
      setIsStreamConnected(true);
      setStreamStatus("WebSocket 已连接");
      setStreamError("");
    });
    vadWsRef.current.onConnectionClose(() => {
      setIsStreamConnected(false);
      setStreamStatus("WebSocket 已断开");
    });
    vadWsRef.current.onConnectionError((msg) => {
      setStreamError(`连接错误: ${msg}`);
      setIsStreamConnected(false);
    });
    vadWsRef.current.onMessageReceived((msg) => {
      if (msg.type === "vad_result") {
        const raw = (msg as unknown as { raw?: unknown }).raw;
        if (raw != null) setStreamSegments((prev) => parseStreamVadRaw(raw, prev));
      } else if (msg.type === "status" && msg.message) {
        setStreamStatus(msg.message);
      } else if (msg.type === "error" && msg.message) {
        setStreamError(msg.message);
      }
    });

    streamRecorderRef.current = new AudioRecorder();
    streamRecorderRef.current.onDataAvailable((float32Array) => {
      if (vadWsRef.current?.isConnected()) {
        const base64Audio = AudioConverter.float32ToBase64(float32Array);
        vadWsRef.current.sendAudioChunk(base64Audio);
      }
    });
    streamRecorderRef.current.onStop(() => {
      setIsStreamRecording(false);
      if (vadWsRef.current?.isConnected()) {
        vadWsRef.current.sendStopVAD();
      }
    });
    streamRecorderRef.current.onError((err) => {
      setStreamError(`录音错误: ${err.message}`);
      setIsStreamRecording(false);
    });

    vadWsRef.current.connect();

    return () => {
      vadWsRef.current?.disconnect();
      if (streamRecorderRef.current?.isRecording()) {
        streamRecorderRef.current.stopRecording();
      }
    };
  }, []);

  useEffect(() => {
    nanoClientIdRef.current = generateClientId();
    nanoWsRef.current = new RealtimeNanoWebSocket(nanoClientIdRef.current);
    nanoWsRef.current.onConnectionOpen(() => {
      setNanoConnected(true);
      setNanoStatus("WebSocket 已连接");
      setNanoError("");
    });
    nanoWsRef.current.onConnectionClose(() => {
      setNanoConnected(false);
      setNanoStatus("WebSocket 已断开");
    });
    nanoWsRef.current.onConnectionError((msg) => {
      setNanoError(`连接错误: ${msg}`);
      setNanoConnected(false);
    });
    nanoWsRef.current.onMessageReceived((msg) => {
      if (msg.type === "recognition_result") {
        setNanoResult((prev) => prev + (msg.text ?? ""));
      } else if (msg.type === "vad_result") {
        const raw = (msg as unknown as { raw?: unknown }).raw;
        if (raw != null) setNanoStreamSegments((prev) => parseStreamVadRaw(raw, prev));
      } else if (msg.type === "status" && msg.message) {
        setNanoStatus(msg.message);
      } else if (msg.type === "error" && msg.message) {
        setNanoError(msg.message);
      }
    });
    nanoRecorderRef.current = new AudioRecorder();
    nanoRecorderRef.current.onDataAvailable((float32Array) => {
      if (nanoWsRef.current?.isConnected()) {
        nanoWsRef.current.sendAudioChunk(AudioConverter.float32ToBase64(float32Array));
      }
    });
    nanoRecorderRef.current.onStop(() => {
      setNanoRecording(false);
      if (nanoWsRef.current?.isConnected()) {
        nanoWsRef.current.sendStop();
      }
    });
    nanoRecorderRef.current.onError((err) => {
      setNanoError(`录音错误: ${err.message}`);
      setNanoRecording(false);
    });
    nanoWsRef.current.connect();
    return () => {
      nanoWsRef.current?.disconnect();
      if (nanoRecorderRef.current?.isRecording()) {
        nanoRecorderRef.current.stopRecording();
      }
    };
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("请选择一个音频文件");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result: VADResponse = await VADAPI.uploadFile(selectedFile);

      if (result.success) {
        setResults(result.segments ?? []);
      } else {
        throw new Error(result.message || "VAD检测失败");
      }
    } catch (err: unknown) {
      setError(`检测失败: ${formatErrorMessage(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setResults([]);
    setError("");
  };

  const handleRetry = () => {
    if (selectedFile) {
      handleUpload();
    }
  };

  const startStreamRecording = async () => {
    if (!isStreamConnected) {
      setStreamError("WebSocket 未连接，请稍候");
      return;
    }
    try {
      setStreamError("");
      setStreamSegments({ completed: [], pendingStart: null });
      vadWsRef.current?.sendStartVAD();
      await streamRecorderRef.current!.startRecording();
      setIsStreamRecording(true);
      setStreamStatus("正在录音...");
    } catch (err) {
      setStreamError(`启动录音失败: ${err}`);
      setIsStreamRecording(false);
    }
  };

  const stopStreamRecording = () => {
    if (streamRecorderRef.current?.isRecording()) {
      streamRecorderRef.current.stopRecording();
    }
  };

  const clearStreamResults = () => {
    setStreamSegments({ completed: [], pendingStart: null });
    setStreamError("");
    setStreamStatus("准备就绪");
  };

  const startNanoRecording = async () => {
    if (!nanoConnected) {
      setNanoError("WebSocket 未连接，请稍候");
      return;
    }
    try {
      setNanoError("");
      setNanoResult("");
      setNanoStreamSegments({ completed: [], pendingStart: null });
      nanoWsRef.current?.sendStart();
      await nanoRecorderRef.current!.startRecording();
      setNanoRecording(true);
      setNanoStatus("正在录音...");
    } catch (err) {
      setNanoError(`启动录音失败: ${err}`);
      setNanoRecording(false);
    }
  };

  const stopNanoRecording = () => {
    if (nanoRecorderRef.current?.isRecording()) {
      nanoRecorderRef.current.stopRecording();
    }
  };

  const clearNanoResult = () => {
    setNanoResult("");
    setNanoStreamSegments({ completed: [], pendingStart: null });
    setNanoError("");
    setNanoStatus("准备就绪");
  };

  if (url !== "/vad-offline" && url !== "/vad-realtime" && url !== "/vad-nano") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {url === "/vad-offline" && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">离线语音活动检测</h1>
              <p className="text-muted-foreground">
                上传音频文件，基于 FSMN-VAD 进行离线语音活动检测
              </p>
            </div>
            <div className="grid grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl">{selectedFile ? "已选择" : "未选择"}</CardTitle>
                      <CardDescription>文件状态</CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`h-3 w-3 rounded-full ${selectedFile ? "bg-blue-500" : "bg-muted-foreground"}`} />
                      <Badge variant={selectedFile ? "default" : "secondary"} className="text-xs">
                        {selectedFile ? "就绪" : "待选"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl">{selectedFile ? formatFileSize(selectedFile.size) : "0"}</CardTitle>
                      <CardDescription>文件大小</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {selectedFile ? selectedFile.type.split("/")[1]?.toUpperCase() || "UNKNOWN" : "N/A"}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg truncate">{isLoading ? "处理中" : "就绪"}</CardTitle>
                      <CardDescription>系统状态</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">{isLoading ? "忙碌" : "空闲"}</Badge>
                  </div>
                </CardHeader>
              </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <ModelManagementCard requiredModel="vad" title="VAD 模型" />

            <Card>
              <CardHeader>
                <CardTitle>选择音频文件</CardTitle>
                <CardDescription>
                  上传音频进行离线语音活动检测，支持 WAV、MP3、M4A、FLAC、OGG，最大 100MB
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUploader
                  accept=".wav,.mp3,.m4a,.flac,.ogg"
                  multiple={false}
                  maxSize={100 * 1024 * 1024}
                  onFilesSelected={setSelectedFiles}
                  onError={setError}
                  disabled={isLoading}
                />

                {/* Action Buttons */}
                {selectedFile && (
                  <div className="flex space-x-4 mt-6">
                    <Button
                      onClick={handleUpload}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? "检测中..." : "开始离线检测"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleClear}
                      disabled={isLoading}
                    >
                      清除
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            <ResultDisplay<VADSegmentList>
              title="离线语音活动检测结果"
              description="检测到的语音片段时间轴"
              data={results.length > 0 ? results : null}
              isLoading={isLoading}
              error={error || null}
              onClear={handleClear}
              onRetry={handleRetry}
              emptyMessage="请上传音频文件开始离线检测"
            >
              {(segments: VADSegmentList) => {
                const list = toSegmentList(segments);
                const rawItems: { start: number; end: number }[] = [];
                list.forEach((seg) => {
                  const p = parseSegment(seg);
                  if (p.ok) rawItems.push((p as { ok: true; start: number; end: number }));
                });
                const validItems = [...rawItems].sort((a, b) => a.start - b.start);
                const totalMs = validItems.reduce((sum, { start, end }) => sum + (end - start), 0);
                const maxEnd = validItems.reduce((max, { end }) => (end > max ? end : max), 0);
                const silences = computeSilenceSegments(validItems, maxEnd);
                return (
                <div className="space-y-4">
                  {/* 摘要信息 */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{validItems.length}</div>
                          <div className="text-sm text-muted-foreground">检测片段</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{(totalMs / 1000).toFixed(2)}s</div>
                          <div className="text-sm text-muted-foreground">语音时长</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 可视化时间轴 */}
                  {validItems.length > 0 && maxEnd > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">时间轴可视化</CardTitle>
                        <CardDescription>深色=语音，浅色=静音</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="relative h-24 bg-muted rounded-lg overflow-hidden">
                          {silences.map(({ start, end }, i) => {
                            const left = (start / maxEnd) * 100;
                            const width = ((end - start) / maxEnd) * 100;
                            const duration = ((end - start) / 1000).toFixed(2);
                            return (
                              <div
                                key={`silence-${i}`}
                                className="absolute h-8 top-0 border border-dashed border-muted-foreground/30 bg-background/60 rounded flex items-center justify-center text-xs text-muted-foreground"
                                style={{
                                  left: `${left}%`,
                                  width: `${width}%`,
                                  minWidth: width < 1 ? "2px" : undefined,
                                }}
                                title={`静音 ${start}ms - ${end}ms (${duration}秒)`}
                              >
                                {width > 8 ? "静音" : null}
                              </div>
                            );
                          })}
                          {validItems.map((segment, listIndex) => {
                            const { start, end } = segment;
                            const left = (start / maxEnd) * 100;
                            const width = ((end - start) / maxEnd) * 100;
                            const duration = ((end - start) / 1000).toFixed(2);
                            return (
                              <div
                                key={`speech-${listIndex}`}
                                className="absolute h-8 top-0 bg-primary hover:bg-primary/80 rounded cursor-pointer transition-all hover:scale-y-110 flex items-center justify-center text-xs text-primary-foreground font-medium"
                                style={{
                                  left: `${left}%`,
                                  width: `${width}%`,
                                  minWidth: width < 1 ? "2px" : undefined,
                                }}
                                title={`片段 ${listIndex + 1}: ${start}ms - ${end}ms (${duration}秒)`}
                              >
                                {width > 10 && `${duration}秒`}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 片段列表 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">片段详情</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {validItems.map(({ start, end }, listIndex) => {
                          const duration = ((end - start) / 1000).toFixed(2);
                          const segmentText = `片段 ${listIndex + 1}: ${start}ms - ${end}ms (时长: ${duration}秒)`;
                          return (
                            <div key={listIndex} className="p-3 bg-muted/50 rounded-lg text-sm">
                              {segmentText}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
              }}
            </ResultDisplay>
              </div>
            </div>
          </>
        )}

        {url === "/vad-realtime" && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">实时语音活动检测</h1>
              <p className="text-muted-foreground">
                基于 FSMN-VAD 的实时流式语音活动检测
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <ModelManagementCard requiredModel="vad" title="VAD 模型" />
                <Card
                  className={
                    isStreamConnected
                      ? "border-green-200 dark:border-green-800"
                      : "border-red-200 dark:border-red-800"
                  }
                >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {isStreamConnected ? "已连接" : "未连接"}
                      </CardTitle>
                      <CardDescription>WebSocket</CardDescription>
                    </div>
                    <div
                      className={`h-3 w-3 rounded-full ${
                        isStreamConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                      }`}
                    />
                  </div>
                </CardHeader>
              </Card>
              {streamError && (
                <Alert variant="destructive">
                  <ErrorIcon className="h-4 w-4" />
                  <AlertTitle>错误</AlertTitle>
                  <AlertDescription>{streamError}</AlertDescription>
                </Alert>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>控制</CardTitle>
                  <CardDescription>{streamStatus}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Button
                      onClick={isStreamRecording ? stopStreamRecording : startStreamRecording}
                      disabled={!isStreamConnected}
                      variant={isStreamRecording ? "destructive" : "default"}
                      className="flex-1"
                    >
                      {isStreamRecording ? (
                        <>
                          <StopIcon className="mr-2 h-4 w-4" />
                          停止检测
                        </>
                      ) : (
                        <>
                          <MicrophoneIcon className="mr-2 h-4 w-4" />
                          开始实时语音活动检测
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={clearStreamResults} className="flex-1">
                      清空结果
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <ResultDisplay<StreamVadState>
                title="实时语音活动检测结果"
                description="流式检测到的语音片段"
                data={
                  streamSegments.completed.length > 0 || streamSegments.pendingStart !== null
                    ? streamSegments
                    : null
                }
                isLoading={isStreamRecording && streamSegments.completed.length === 0 && streamSegments.pendingStart === null}
                error={streamError || null}
                onClear={clearStreamResults}
                onRetry={clearStreamResults}
                emptyMessage="点击「开始实时语音活动检测」并说话"
              >
                {(data: StreamVadState) => {
                  const { completed, pendingStart } = data;
                  const validItems = [...completed].sort((a, b) => a.start - b.start);
                  const totalMs = validItems.reduce((sum, { start, end }) => sum + (end - start), 0);
                  const maxEnd = Math.max(
                    ...validItems.map((s) => s.end),
                    pendingStart !== null ? pendingStart + 2000 : 0
                  );
                  const silences = computeSilenceSegments(validItems, maxEnd);
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <div className="text-2xl font-bold">
                                {validItems.length + (pendingStart !== null ? 1 : 0)}
                              </div>
                              <div className="text-sm text-muted-foreground">检测片段</div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <div className="text-2xl font-bold">
                                {(totalMs / 1000).toFixed(2)}s
                              </div>
                              <div className="text-sm text-muted-foreground">语音时长</div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      {(validItems.length > 0 || pendingStart !== null) && maxEnd > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">时间轴可视化</CardTitle>
                            <CardDescription>深色=语音，浅色=静音</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="relative h-24 bg-muted rounded-lg overflow-hidden">
                              {silences.map(({ start, end }, i) => {
                                const left = (start / maxEnd) * 100;
                                const width = ((end - start) / maxEnd) * 100;
                                const duration = ((end - start) / 1000).toFixed(2);
                                return (
                                  <div
                                    key={`silence-${i}`}
                                    className="absolute h-8 top-0 border border-dashed border-muted-foreground/30 bg-background/60 rounded flex items-center justify-center text-xs text-muted-foreground"
                                    style={{
                                      left: `${left}%`,
                                      width: `${width}%`,
                                      minWidth: width < 1 ? "2px" : undefined,
                                    }}
                                    title={`静音 ${start}ms - ${end}ms (${duration}秒)`}
                                  >
                                    {width > 8 ? "静音" : null}
                                  </div>
                                );
                              })}
                              {validItems.map((segment, listIndex) => {
                                const { start, end } = segment;
                                const left = (start / maxEnd) * 100;
                                const width = ((end - start) / maxEnd) * 100;
                                const duration = ((end - start) / 1000).toFixed(2);
                                return (
                                  <div
                                    key={`speech-${listIndex}`}
                                    className="absolute h-8 top-0 bg-primary hover:bg-primary/80 rounded cursor-pointer transition-all hover:scale-y-110 flex items-center justify-center text-xs text-primary-foreground font-medium"
                                    style={{
                                      left: `${left}%`,
                                      width: `${width}%`,
                                      minWidth: width < 1 ? "2px" : undefined,
                                    }}
                                    title={`片段 ${listIndex + 1}: ${start}ms - ${end}ms (${duration}秒)`}
                                  >
                                    {width > 10 && `${duration}秒`}
                                  </div>
                                );
                              })}
                              {pendingStart !== null && maxEnd > 0 && (
                                <div
                                  className="absolute h-8 top-0 bg-primary/70 border-2 border-primary border-dashed rounded animate-pulse flex items-center justify-center text-xs text-primary-foreground font-medium"
                                  style={{
                                    left: `${(pendingStart / maxEnd) * 100}%`,
                                    width: `${Math.max(5, ((maxEnd - pendingStart) / maxEnd) * 100)}%`,
                                  }}
                                  title={`语音进行中 @ ${(pendingStart / 1000).toFixed(2)}s`}
                                >
                                  进行中
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">片段详情</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {validItems.map(({ start, end }, listIndex) => {
                              const duration = ((end - start) / 1000).toFixed(2);
                              return (
                                <div key={listIndex} className="p-3 bg-muted/50 rounded-lg text-sm">
                                  片段 {listIndex + 1}: {start}ms - {end}ms (时长: {duration}秒)
                                </div>
                              );
                            })}
                            {pendingStart !== null && (
                              <div className="p-3 bg-primary/20 border border-primary/50 rounded-lg text-sm font-medium">
                                语音进行中 @ {(pendingStart / 1000).toFixed(2)}s
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                }}
              </ResultDisplay>
              </div>
            </div>
          </>
        )}

        {url === "/vad-nano" && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">实时识别 (FunASR-Nano)</h1>
              <p className="text-muted-foreground">
                基于实时语音活动检测切分，将语音片段发送给 FunASR-Nano 进行离线识别，实现准实时出字效果。请先加载 VAD 与离线识别模型。
              </p>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <ModelManagementCard
                    requiredModel="offline_asr"
                    title="离线识别模型"
                  />
                  <Card
                    className={
                      nanoConnected
                        ? "border-green-200 dark:border-green-800"
                        : "border-red-200 dark:border-red-800"
                    }
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {nanoConnected ? "已连接" : "未连接"}
                          </CardTitle>
                          <CardDescription>WebSocket</CardDescription>
                        </div>
                        <div
                          className={`h-3 w-3 rounded-full ${
                            nanoConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                          }`}
                        />
                      </div>
                    </CardHeader>
                  </Card>
                  {nanoError && (
                    <Alert variant="destructive">
                      <ErrorIcon className="h-4 w-4" />
                      <AlertTitle>错误</AlertTitle>
                      <AlertDescription>{nanoError}</AlertDescription>
                    </Alert>
                  )}
                  <Card>
                    <CardHeader>
                      <CardTitle>控制</CardTitle>
                      <CardDescription>{nanoStatus}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4">
                        <Button
                          onClick={nanoRecording ? stopNanoRecording : startNanoRecording}
                          disabled={!nanoConnected}
                          variant={nanoRecording ? "destructive" : "default"}
                          className="flex-1"
                        >
                          {nanoRecording ? (
                            <>
                              <StopIcon className="mr-2 h-4 w-4" />
                              停止识别
                            </>
                          ) : (
                            <>
                              <MicrophoneIcon className="mr-2 h-4 w-4" />
                              开始实时识别
                            </>
                          )}
                        </Button>
                        <Button variant="outline" onClick={clearNanoResult} className="flex-1">
                          清空结果
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div className="space-y-6">
                  <Card className="min-h-[280px] flex flex-col">
                    <CardHeader>
                      <CardTitle>识别结果</CardTitle>
                      <CardDescription>按句/段实时输出的识别文本</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col min-h-0">
                      <div className="rounded-lg border bg-muted p-6 flex-1 min-h-[200px] overflow-y-auto">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {nanoResult || "点击「开始实时识别」并说话，识别结果将在此显示"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <ResultDisplay<StreamVadState>
                    title="流式语音片段"
                    description="VAD 实时检测到的语音片段时间轴"
                    data={
                      nanoStreamSegments.completed.length > 0 || nanoStreamSegments.pendingStart !== null
                        ? nanoStreamSegments
                        : null
                    }
                    isLoading={nanoRecording && nanoStreamSegments.completed.length === 0 && nanoStreamSegments.pendingStart === null}
                    error={null}
                    onClear={clearNanoResult}
                    onRetry={clearNanoResult}
                    emptyMessage="开始识别后，检测到的语音片段将在此显示"
                  >
                    {(data: StreamVadState) => {
                      const { completed, pendingStart } = data;
                      const validItems = [...completed].sort((a, b) => a.start - b.start);
                      const totalMs = validItems.reduce((sum, { start, end }) => sum + (end - start), 0);
                      const maxEnd = Math.max(
                        ...validItems.map((s) => s.end),
                        pendingStart !== null ? pendingStart + 2000 : 0
                      );
                      const silences = computeSilenceSegments(validItems, maxEnd);
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <Card>
                              <CardContent className="pt-6">
                                <div className="text-center">
                                  <div className="text-2xl font-bold">
                                    {validItems.length + (pendingStart !== null ? 1 : 0)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">检测片段</div>
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-6">
                                <div className="text-center">
                                  <div className="text-2xl font-bold">{(totalMs / 1000).toFixed(2)}s</div>
                                  <div className="text-sm text-muted-foreground">语音时长</div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                          {(validItems.length > 0 || pendingStart !== null) && maxEnd > 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg">时间轴</CardTitle>
                                <CardDescription>深色=语音，浅色=静音</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="relative h-24 bg-muted rounded-lg overflow-hidden">
                                  {silences.map(({ start, end }, i) => {
                                    const left = (start / maxEnd) * 100;
                                    const width = ((end - start) / maxEnd) * 100;
                                    return (
                                      <div
                                        key={`nano-silence-${i}`}
                                        className="absolute h-8 top-0 border border-dashed border-muted-foreground/30 bg-background/60 rounded flex items-center justify-center text-xs text-muted-foreground"
                                        style={{
                                          left: `${left}%`,
                                          width: `${width}%`,
                                          minWidth: width < 1 ? "2px" : undefined,
                                        }}
                                        title={`静音 ${start}ms - ${end}ms`}
                                      >
                                        {width > 8 ? "静音" : null}
                                      </div>
                                    );
                                  })}
                                  {validItems.map((segment, listIndex) => {
                                    const { start, end } = segment;
                                    const left = (start / maxEnd) * 100;
                                    const width = ((end - start) / maxEnd) * 100;
                                    const duration = ((end - start) / 1000).toFixed(2);
                                    return (
                                      <div
                                        key={`nano-speech-${listIndex}`}
                                        className="absolute h-8 top-0 bg-primary hover:bg-primary/80 rounded cursor-pointer transition-all flex items-center justify-center text-xs text-primary-foreground font-medium"
                                        style={{
                                          left: `${left}%`,
                                          width: `${width}%`,
                                          minWidth: width < 1 ? "2px" : undefined,
                                        }}
                                        title={`片段 ${listIndex + 1}: ${start}ms - ${end}ms (${duration}秒)`}
                                      >
                                        {width > 10 && `${duration}秒`}
                                      </div>
                                    );
                                  })}
                                  {pendingStart !== null && maxEnd > 0 && (
                                    <div
                                      className="absolute h-8 top-0 bg-primary/70 border-2 border-primary border-dashed rounded animate-pulse flex items-center justify-center text-xs text-primary-foreground font-medium"
                                      style={{
                                        left: `${(pendingStart / maxEnd) * 100}%`,
                                        width: `${Math.max(5, ((maxEnd - pendingStart) / maxEnd) * 100)}%`,
                                      }}
                                      title={`语音进行中 @ ${(pendingStart / 1000).toFixed(2)}s`}
                                    >
                                      进行中
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">片段详情</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {validItems.map(({ start, end }, listIndex) => {
                                  const duration = ((end - start) / 1000).toFixed(2);
                                  return (
                                    <div key={listIndex} className="p-3 bg-muted/50 rounded-lg text-sm">
                                      片段 {listIndex + 1}: {start}ms - {end}ms (时长: {duration}秒)
                                    </div>
                                  );
                                })}
                                {pendingStart !== null && (
                                  <div className="p-3 bg-primary/20 border border-primary/50 rounded-lg text-sm font-medium">
                                    语音进行中 @ {(pendingStart / 1000).toFixed(2)}s
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    }}
                  </ResultDisplay>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}