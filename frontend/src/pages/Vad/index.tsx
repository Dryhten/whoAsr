import { useState } from "preact/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ModelManagementCard } from "@/components/ModelManagementCard";
import { VADAPI, VADResponse, VADSegmentList } from "../../api";
import { ErrorIcon, SpinnerIcon, CheckIcon, TrashIcon, InfoIcon, CopyIcon, UploadIcon } from "@/components/icons";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function Vad() {
  useDocumentTitle("语音端点检测");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [results, setResults] = useState<VADSegmentList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      setSelectedFile(file);
      setError("");
      setResults([]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("请选择一个音频文件");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result: VADResponse = await VADAPI.uploadFile(selectedFile);

      if (result.success && result.segments) {
        setResults(result.segments);
      } else {
        throw new Error(result.message || "VAD检测失败");
      }
    } catch (err: any) {
      setError(`检测失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setResults([]);
    setError("");
    // Reset file input
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatSegments = (segments: VADSegmentList[]) => {
    return segments.map((segment, index) => {
      if (Array.isArray(segment) && segment.length >= 2) {
        const [start, end] = segment;
        if (typeof start === 'number' && typeof end === 'number') {
          const duration = ((end - start) / 1000).toFixed(2);
          return `片段 ${index + 1}: ${start}ms - ${end}ms (时长: ${duration}秒)`;
        }
      }
      return `片段 ${index + 1}: ${JSON.stringify(segment)}`;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            VAD - 语音端点检测
          </h1>
          <p className="text-muted-foreground">
            基于FSMN-VAD的语音活动检测系统，精准识别音频中的语音片段
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {selectedFile ? "已选择" : "未选择"}
                  </CardTitle>
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
                  <CardTitle className="text-2xl">
                    {selectedFile ? formatFileSize(selectedFile.size) : "0"}
                  </CardTitle>
                  <CardDescription>文件大小</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {selectedFile ? selectedFile.type.split('/')[1]?.toUpperCase() || "UNKNOWN" : "N/A"}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg truncate">
                    {isLoading ? "处理中" : "就绪"}
                  </CardTitle>
                  <CardDescription>系统状态</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {isLoading ? "忙碌" : "空闲"}
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-6">
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

            {/* File Upload Panel */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>文件上传</CardTitle>
                <CardDescription>
                  选择音频文件进行语音端点检测 (支持 WAV, MP3, M4A, FLAC, OGG)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                    <input
                      id="file-input"
                      type="file"
                      accept="audio/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="text-center">
                      <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div className="mt-4">
                        <label
                          htmlFor="file-input"
                          className="cursor-pointer inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
                        >
                          选择文件
                        </label>
                      </div>
                      {selectedFile && (
                        <div className="mt-4 text-sm text-muted-foreground">
                          <p>已选择: {selectedFile.name}</p>
                          <p>大小: {formatFileSize(selectedFile.size)}</p>
                          <p>类型: {selectedFile.type}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={handleUpload}
                      disabled={isLoading || !selectedFile}
                      size="lg"
                      className="flex-1"
                    >
                      {isLoading ? (
                        <>
                          <SpinnerIcon className="mr-2 h-4 w-4" />
                          处理中
                        </>
                      ) : (
                        <>
                          <CheckIcon className="mr-2 h-4 w-4" />
                          开始检测
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={handleClear}
                      variant="outline"
                      size="lg"
                      className="flex-1"
                    >
                      <TrashIcon className="mr-2 h-4 w-4" />
                      清空
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Panel */}
            {results.length > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>检测结果</CardTitle>
                      <CardDescription>
                        共检测到 {results.length} 个语音活动片段
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const resultText = formatSegments(results).join('\n');
                          navigator.clipboard.writeText(resultText);
                        }}
                      >
                        <CopyIcon className="mr-2 h-4 w-4" />
                        复制
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Timeline Visualization */}
                  <div className="rounded-lg border bg-muted p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium mb-2">时间轴视图</h3>
                      <p className="text-sm text-muted-foreground">
                        语音活动片段的时间分布 (点击片段查看详情)
                      </p>
                    </div>

                    {/* Timeline */}
                    <div className="relative">
                      {(() => {
                        const segments = results.filter(segment =>
                          Array.isArray(segment) && segment.length >= 2 &&
                          typeof segment[0] === 'number' && typeof segment[1] === 'number'
                        );

                        if (segments.length === 0) {
                          return (
                            <div className="text-center py-8 text-muted-foreground">
                              无有效的时间片段数据
                            </div>
                          );
                        }

                        const maxTime = Math.max(...segments.map(s => s[1] as unknown as number));
                        const timelineWidth = 100; // percentage

                        return (
                          <div>
                            {/* Time labels */}
                            <div className="relative h-8 mb-2">
                              <div className="absolute inset-0 flex justify-between text-xs text-muted-foreground">
                                <span>0ms</span>
                                <span>{Math.round(maxTime / 2)}ms</span>
                                <span>{maxTime}ms</span>
                              </div>
                            </div>

                            {/* Timeline bar */}
                            <div className="relative h-12 bg-background border rounded-lg overflow-hidden">
                              <div className="absolute inset-0 flex items-center px-2">
                                {segments.map((segment, index) => {
                                  const start = segment[0] as unknown as number;
                                  const end = segment[1] as unknown as number;
                                  const left = (start / maxTime) * timelineWidth;
                                  const width = ((end - start) / maxTime) * timelineWidth;
                                  const duration = ((end - start) / 1000).toFixed(2);

                                  return (
                                    <div
                                      key={index}
                                      className="absolute h-8 bg-primary hover:bg-primary/80 rounded cursor-pointer transition-all hover:scale-y-110 flex items-center justify-center text-xs text-primary-foreground font-medium"
                                      style={{
                                        left: `${left}%`,
                                        width: `${width}%`,
                                        minWidth: width < 1 ? '2px' : undefined
                                      }}
                                      title={`片段 ${index + 1}: ${start}ms - ${end}ms (${duration}秒)`}
                                    >
                                      {width > 5 && `${index + 1}`}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Legend */}
                            <div className="mt-4 flex items-center justify-center space-x-6 text-xs text-muted-foreground">
                              <div className="flex items-center">
                                <div className="w-3 h-3 bg-primary rounded mr-2"></div>
                                <span>语音活动</span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-3 h-3 bg-muted border rounded mr-2"></div>
                                <span>静音/非语音</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Detailed Segments List */}
                  <div className="rounded-lg border bg-muted p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium mb-2">详细片段信息</h3>
                      <p className="text-sm text-muted-foreground">
                        所有检测到的语音活动片段详细信息
                      </p>
                    </div>
                    <div className="space-y-2">
                      {formatSegments(results).map((segmentText, index) => (
                        <div key={index} className="text-sm leading-relaxed p-3 bg-background rounded border hover:border-primary/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <span>{segmentText}</span>
                            {(() => {
                              const segment = results[index];
                              if (Array.isArray(segment) && segment.length >= 2 &&
                                  typeof segment[0] === 'number' && typeof segment[1] === 'number') {
                                const duration = ((segment[1]! - segment[0]!) / 1000).toFixed(2);
                                return (
                                  <Badge variant="outline" className="text-xs">
                                    {duration}秒
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary">{results.length}</div>
                        <div className="text-xs text-muted-foreground">检测片段</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary">
                          {(() => {
                            const validSegments = results.filter(segment =>
                              Array.isArray(segment) && segment.length >= 2 &&
                              typeof segment[0] === 'number' && typeof segment[1] === 'number'
                            );
                            if (validSegments.length === 0) return "0";
                            const totalDuration = validSegments.reduce((sum, segment) =>
                              sum + ((segment[1] as unknown as number) - (segment[0] as unknown as number)), 0
                            );
                            return (totalDuration / 1000).toFixed(1);
                          })()}
                        </div>
                        <div className="text-xs text-muted-foreground">总语音时长(秒)</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary">
                          {(() => {
                            const validSegments = results.filter(segment =>
                              Array.isArray(segment) && segment.length >= 2 &&
                              typeof segment[0] === 'number' && typeof segment[1] === 'number'
                            );
                            if (validSegments.length === 0) return "0";
                            const totalDuration = validSegments.reduce((sum, segment) =>
                              sum + ((segment[1] as unknown as number) - (segment[0] as unknown as number)), 0
                            );
                            const avgDuration = totalDuration / validSegments.length;
                            return (avgDuration / 1000).toFixed(2);
                          })()}
                        </div>
                        <div className="text-xs text-muted-foreground">平均片段时长(秒)</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary">
                          {(() => {
                            const validSegments = results.filter(segment =>
                              Array.isArray(segment) && segment.length >= 2 &&
                              typeof segment[0] === 'number' && typeof segment[1] === 'number'
                            );
                            if (validSegments.length === 0) return "0%";
                            const totalSpeechTime = validSegments.reduce((sum, segment) =>
                              sum + ((segment[1] as unknown as number) - (segment[0] as unknown as number)), 0
                            );
                            const maxTime = Math.max(...validSegments.map(s => s[1] as unknown as number));
                            const percentage = ((totalSpeechTime / maxTime) * 100).toFixed(1);
                            return `${percentage}%`;
                          })()}
                        </div>
                        <div className="text-xs text-muted-foreground">语音占比</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex items-center text-sm text-muted-foreground">
                    <InfoIcon className="mr-2 h-4 w-4" />
                    <span>VAD检测完成</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!results.length && !error && !isLoading && (
              <Card className="border-dashed">
                <CardContent className="flex h-[400px] flex-col items-center justify-center p-6">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <UploadIcon className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">准备上传文件</h3>
                    <p className="text-sm text-muted-foreground">
                      选择音频文件，点击"开始检测"进行语音端点检测
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <ModelManagementCard
              requiredModel="vad"
              compact={false}
              showLoadButton={true}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">功能说明</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>• 高精度语音端点检测</p>
                  <p>• 支持多种音频格式</p>
                  <p>• 离线处理，保护隐私</p>
                  <p>• 毫秒级时间精度</p>
                  <p>• 批量文件处理</p>
                  <p>• 详细时间片段信息</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">支持格式</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">WAV</Badge>
                  <Badge variant="outline" className="text-xs">MP3</Badge>
                  <Badge variant="outline" className="text-xs">M4A</Badge>
                  <Badge variant="outline" className="text-xs">FLAC</Badge>
                  <Badge variant="outline" className="text-xs">OGG</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">技术参数</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>模型: FSMN-VAD</p>
                  <p>时间精度: 毫秒级</p>
                  <p>检测类型: 语音活动检测</p>
                  <p>处理方式: 离线批量</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}