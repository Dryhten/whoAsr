import { useState, useEffect, useRef } from "preact/hooks";
import {
  InspectWebSocket,
  InspectMonitoringAPI,
  InspectConnection,
  generateClientId,
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
import { ErrorIcon, RefreshIcon, InfoIcon, PlayIcon, StopIcon } from "@/components/icons";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function InspectAsr() {
  useDocumentTitle("实时巡检监控");
  const [connections, setConnections] = useState<InspectConnection[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [monitoringResult, setMonitoringResult] = useState("");
  const [status, setStatus] = useState("准备就绪");
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const monitoringAPI = useRef<InspectMonitoringAPI>(new InspectMonitoringAPI());
  const wsRef = useRef<InspectWebSocket | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 初始化监控API
    monitoringAPI.current = new InspectMonitoringAPI();
    
    // 加载连接列表
    loadConnections();
    
    // 设置定时刷新
    refreshIntervalRef.current = setInterval(loadConnections, 5000);

    // 清理函数
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, []);

  const loadConnections = async () => {
    try {
      const response = await monitoringAPI.current.getActiveConnections();
      setConnections(response.connections);
      setError("");
    } catch (err) {
      setError(`加载连接列表失败: ${err}`);
    }
  };

  const refreshConnections = async () => {
    setIsRefreshing(true);
    await loadConnections();
    setIsRefreshing(false);
  };

  const selectClient = (clientId: string) => {
    if (selectedClient === clientId) {
      // 如果选择的是当前客户端，则取消选择
      setSelectedClient("");
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      setMonitoringResult("");
      setStatus("准备就绪");
    } else {
      // 选择新的客户端
      setSelectedClient(clientId);
      startMonitoring(clientId);
    }
  };

  const startMonitoring = (clientId: string) => {
    // 断开之前的连接
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }

    // 创建新的监控连接
    const connection = connections.find(c => c.client_id === clientId);
    if (!connection) {
      setError("找不到选中的连接");
      return;
    }

    // 使用一个特殊的监控客户端ID，但标记为监控模式
    const monitorClientId = `monitor_${Date.now()}`;
    wsRef.current = new InspectWebSocket(monitorClientId, connection.inspect_id);

    // 设置事件监听器
    wsRef.current.onConnectionOpen(() => {
      setStatus(`正在监控客户端: ${clientId}`);
      setError("");
    });

    wsRef.current.onConnectionClose(() => {
      setStatus("监控连接已断开");
    });

    wsRef.current.onConnectionError((error) => {
      setError(`监控连接错误: ${error}`);
    });

    wsRef.current.onMessageReceived((message) => {
      handleMonitoringMessage(message, clientId);
    });

    // 连接WebSocket
    wsRef.current.connect();
  };

  const handleMonitoringMessage = (message: any, clientId: string) => {
    if (message.type === "recognition_result") {
      setMonitoringResult((prev) => prev + message.text);
    } else if (message.type === "error") {
      setError(`客户端 ${clientId} 错误: ${message.message}`);
    } else if (message.type === "status") {
      setStatus(`客户端 ${clientId}: ${message.message}`);
    }
  };

  const clearMonitoringResult = () => {
    setMonitoringResult("");
    setError("");
    setStatus("准备就绪");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            实时巡检监控
          </h1>
          <p className="text-muted-foreground">
            监控其他客户端的WebSocket连接和语音识别结果
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{connections.length}</CardTitle>
                  <CardDescription>活跃连接数</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <Badge variant="outline" className="text-xs">
                    监控中
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {selectedClient ? "已选择" : "未选择"}
                  </CardTitle>
                  <CardDescription>监控状态</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      selectedClient ? "bg-green-500 animate-pulse" : "bg-muted-foreground"
                    }`}
                  />
                  <Badge
                    variant={selectedClient ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {selectedClient ? "监控中" : "待选择"}
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
                <Button
                  onClick={refreshConnections}
                  disabled={isRefreshing}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  <RefreshIcon className={`mr-1 h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
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

            {/* Client List */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>活跃连接列表</CardTitle>
                <CardDescription>
                  选择要监控的客户端连接
                </CardDescription>
              </CardHeader>
              <CardContent>
                {connections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <InfoIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无活跃连接</p>
                    <p className="text-sm">等待其他客户端连接...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {connections.map((connection) => (
                      <div
                        key={connection.client_id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedClient === connection.client_id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => selectClient(connection.client_id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-semibold">{connection.client_id}</h3>
                              <Badge
                                variant={connection.is_connected ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {connection.is_connected ? "在线" : "离线"}
                              </Badge>
                              {connection.is_recording && (
                                <Badge variant="destructive" className="text-xs">
                                  录音中
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              巡检ID: {connection.inspect_id}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {selectedClient === connection.client_id ? (
                              <StopIcon className="h-4 w-4 text-primary" />
                            ) : (
                              <PlayIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monitoring Results */}
            {selectedClient && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle>监控结果 - {selectedClient}</CardTitle>
                    <Button
                      onClick={clearMonitoringResult}
                      variant="outline"
                      size="sm"
                    >
                      清空结果
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {monitoringResult ? (
                    <div className="rounded-lg border bg-muted p-6 min-h-[200px]">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {monitoringResult}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-muted p-6 min-h-[200px] flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <InfoIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>等待识别结果...</p>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex items-center text-sm text-muted-foreground">
                    <InfoIcon className="mr-2 h-4 w-4" />
                    <span>实时监控中，识别结果会自动更新</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!selectedClient && !error && (
              <Card className="border-dashed">
                <CardContent className="flex h-[400px] flex-col items-center justify-center p-6">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <InfoIcon className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">选择要监控的客户端</h3>
                    <p className="text-sm text-muted-foreground">
                      从左侧列表中选择一个客户端连接进行监控
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
                <CardTitle className="text-base">监控信息</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      总连接数
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {connections.length}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">监控状态</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedClient ? "监控中" : "待选择"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">刷新间隔</span>
                    <Badge variant="secondary" className="text-xs">
                      5秒
                    </Badge>
                  </div>
                  {selectedClient && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">监控客户端</span>
                        <Badge variant="outline" className="text-xs">
                          {selectedClient}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
