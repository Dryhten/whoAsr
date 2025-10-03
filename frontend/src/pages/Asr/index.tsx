import { useState, useEffect, useRef } from "preact/hooks";
import {
  SpeechRecognitionWebSocket,
  AudioRecorder,
  AudioConverter,
  generateClientId,
  WebSocketMessage,
} from "../../api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ModelManagementCard } from "@/components/ModelManagementCard";
import { ErrorIcon, StopIcon, MicrophoneIcon, TrashIcon, InfoIcon } from "@/components/icons";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function Asr() {
  useDocumentTitle("实时语音识别");
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("准备就绪");
  const [error, setError] = useState("");

  const wsRef = useRef<SpeechRecognitionWebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const clientIdRef = useRef<string>("");

  useEffect(() => {
    // 初始化客户端ID
    clientIdRef.current = generateClientId();

    // 初始化WebSocket连接
    wsRef.current = new SpeechRecognitionWebSocket(clientIdRef.current);

    // 设置WebSocket事件监听器
    wsRef.current.onConnectionOpen(() => {
      setIsConnected(true);
      setStatus("WebSocket连接已建立");
      setError("");
    });

    wsRef.current.onConnectionClose(() => {
      setIsConnected(false);
      setStatus("WebSocket连接已断开");
    });

    wsRef.current.onConnectionError((error) => {
      setError(`WebSocket连接错误: ${error}`);
      setIsConnected(false);
    });

    wsRef.current.onMessageReceived((message) => {
      handleMessage(message);
    });

    // 初始化音频录制器
    audioRecorderRef.current = new AudioRecorder();

    // 设置音频录制器事件监听器
    audioRecorderRef.current.onDataAvailable((float32Array) => {
      if (wsRef.current && wsRef.current.isConnected()) {
        try {
          // 直接将 Float32Array 数据转换为 Base64
          const base64Audio = AudioConverter.float32ToBase64(float32Array);
          wsRef.current.sendAudioChunk(base64Audio);
        } catch (err) {
          setError(`音频处理错误: ${err}`);
        }
      }
    });

    audioRecorderRef.current.onStop(() => {
      setIsRecording(false);
      if (wsRef.current && wsRef.current.isConnected()) {
        wsRef.current.stopRecording();
      }
    });

    audioRecorderRef.current.onError((err) => {
      setError(`音频录制错误: ${err.message}`);
      setIsRecording(false);
    });

    // 连接WebSocket
    wsRef.current.connect();

    // 清理函数
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      if (audioRecorderRef.current && audioRecorderRef.current.isRecording()) {
        audioRecorderRef.current.stopRecording();
      }
    };
  }, []);

  const handleMessage = (message: WebSocketMessage) => {
    if (message.type === "recognition_result") {
      setResult((prev) => prev + message.text);
    } else if (message.type === "error") {
      setError(message.message || "WebSocket错误");
    } else if (message.type === "status") {
      setStatus(message.message || "状态更新");
    }
  };

  const startRecording = async () => {
    if (!isConnected) {
      setError("WebSocket未连接，请等待连接建立");
      return;
    }

    try {
      setError("");
      setResult("");

      // 开始音频录制
      await audioRecorderRef.current!.startRecording();
      setIsRecording(true);
      setStatus("正在录音...");

      // 通知后端开始录制
      wsRef.current!.startRecording();
    } catch (err) {
      setError(`启动录音失败: ${err}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (audioRecorderRef.current && audioRecorderRef.current.isRecording()) {
      audioRecorderRef.current.stopRecording();
    }
  };

  const clearResults = () => {
    setResult("");
    setError("");
    setStatus("准备就绪");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            ASR - 实时语音识别
          </h1>
          <p className="text-muted-foreground">
            基于FunASR的高精度中文语音识别系统
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <Card
            className={
              isConnected
                ? "border-green-200 dark:border-green-800"
                : "border-red-200 dark:border-red-800"
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {isConnected ? "已连接" : "未连接"}
                  </CardTitle>
                  <CardDescription>连接状态</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                    }`}
                  />
                  <Badge
                    variant={isConnected ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {isConnected ? "在线" : "离线"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card
            className={
              isRecording
                ? "border-red-200 dark:border-red-800"
                : "border-border"
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {isRecording ? "正在录音" : "未录音"}
                  </CardTitle>
                  <CardDescription>录音状态</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      isRecording
                        ? "bg-red-500 animate-pulse"
                        : "bg-muted-foreground"
                    }`}
                  />
                  <Badge
                    variant={isRecording ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {isRecording ? "录音中" : "待机"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg truncate">{status}</CardTitle>
                  <CardDescription>系统状态</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  系统
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-6 items-start">
          {/* Main Content */}
          <div className="col-span-2 space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <ErrorIcon className="h-4 w-4" />
                <AlertTitle>错误</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Control Panel */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>控制面板</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={!isConnected}
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    className="flex-1"
                  >
                    {isRecording ? (
                      <>
                        <StopIcon className="mr-2 h-4 w-4" />
                        停止录音
                      </>
                    ) : (
                      <>
                        <MicrophoneIcon className="mr-2 h-4 w-4" />
                        开始录音
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={clearResults}
                    variant="outline"
                    size="lg"
                    className="flex-1"
                  >
                    <TrashIcon className="mr-2 h-4 w-4" />
                    清空结果
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results Panel */}
            {result && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>识别结果</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-muted p-6 min-h-[200px]">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {result}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center text-sm text-muted-foreground">
                    <InfoIcon className="mr-2 h-4 w-4" />
                    <span>实时识别中，文本会自动更新</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!result && !error && (
              <Card className="border-dashed">
                <CardContent className="flex h-[400px] flex-col items-center justify-center p-6">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <MicrophoneIcon className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">准备开始录音</h3>
                    <p className="text-sm text-muted-foreground">
                      点击"开始录音"按钮进行语音识别
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <ModelManagementCard
              requiredModel="streaming_asr"
              compact={false}
              showLoadButton={true}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">系统信息</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      客户端ID
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {clientIdRef.current}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">协议</span>
                    <Badge variant="secondary" className="text-xs">
                      WebSocket
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">状态</span>
                    <Badge variant="outline" className="text-xs">
                      {isConnected ? "连接中" : "未连接"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
