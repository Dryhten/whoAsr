import { useState } from "preact/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ModelManagementCard } from "@/components/ModelManagementCard";
import { TimestampAPI, TimestampResponse, TimestampSegment } from "../../api";
import { ErrorIcon, SpinnerIcon, CheckIcon, TrashIcon, InfoIcon, CopyIcon, UploadIcon } from "@/components/icons";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { formatFileSize } from "@/lib/format";

export function Timestamp() {
  useDocumentTitle("时间戳预测");
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [selectedTextFile, setSelectedTextFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState("");
  const [textInputMode, setTextInputMode] = useState<"file" | "direct">("direct");
  const [results, setResults] = useState<TimestampSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAudioFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      if (TimestampAPI.validateAudioFile(file)) {
        setSelectedAudioFile(file);
        setError("");
        setResults([]);
      } else {
        setError("不支持的音频文件格式。请上传 WAV, MP3, M4A, FLAC, OGG 文件。");
      }
    }
  };

  const handleTextFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      if (TimestampAPI.validateTextFile(file)) {
        setSelectedTextFile(file);
        setError("");
        setResults([]);
        // 自动读取文件内容
        TimestampAPI.readFileAsText(file).then(content => {
          setTextContent(content);
        }).catch(err => {
          setError("读取文本文件失败: " + err.message);
        });
      } else {
        setError("不支持的文本文件格式。请上传 TXT, MD, JSON 等文件。");
      }
    }
  };

  const handleTextInputChange = (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    setTextContent(target.value);
    setError("");
    setResults([]);
  };

  const handlePredict = async () => {
    if (!selectedAudioFile) {
      setError("请选择音频文件");
      return;
    }

    // Check text input
    if (textInputMode === "direct" && !textContent.trim()) {
      setError("请输入文本内容");
      return;
    }

    if (textInputMode === "file" && !selectedTextFile) {
      setError("请选择文本文件");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      let response: TimestampResponse;

      if (textInputMode === "direct") {
        response = await TimestampAPI.uploadAndPredict(
          selectedAudioFile,
          undefined,
          textContent.trim()
        );
      } else {
        response = await TimestampAPI.uploadAndPredict(
          selectedAudioFile,
          selectedTextFile!
        );
      }

      if (response.success && response.results) {
        setResults(response.results);
      } else {
        throw new Error(response.message || "时间戳预测失败");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      setError("预测失败: " + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedAudioFile(null);
    setSelectedTextFile(null);
    setTextContent("");
    setResults([]);
    setError("");
    // Reset file inputs
    const audioInput = document.getElementById("audio-input") as HTMLInputElement;
    const textInput = document.getElementById("text-input") as HTMLInputElement;
    if (audioInput) audioInput.value = "";
    if (textInput) textInput.value = "";
  };

  
  const getTotalDuration = () => {
    if (results.length === 0) return 0;
    return Math.max(...results.map(r => r.end));
  };

  const calculateStats = () => {
    if (results.length === 0) {
      return { totalSegments: 0, totalDuration: 0, avgDuration: 0, avgConfidence: 0 };
    }

    const totalDuration = getTotalDuration();
    const totalSpeechTime = results.reduce((sum, segment) => sum + (segment.end - segment.start), 0);
    const avgDuration = totalSpeechTime / results.length;
    const avgConfidence = results.reduce((sum, segment) => sum + segment.confidence, 0) / results.length;

    return {
      totalSegments: results.length,
      totalDuration: totalDuration,
      avgDuration: avgDuration,
      avgConfidence: avgConfidence
    };
  };

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            时间戳预测
          </h1>
          <p className="text-muted-foreground">
            基于FunASR的时间戳预测模型，为语音文本同步提供精准时间定位
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {selectedAudioFile ? "已选择" : "未选择"}
                  </CardTitle>
                  <CardDescription>音频文件</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`h-3 w-3 rounded-full ${selectedAudioFile ? "bg-blue-500" : "bg-muted-foreground"}`} />
                  <Badge variant={selectedAudioFile ? "default" : "secondary"} className="text-xs">
                    {selectedAudioFile ? "就绪" : "待选"}
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
                    {(textInputMode === "direct" && textContent.trim()) || (textInputMode === "file" && selectedTextFile) ? "已就绪" : "待输入"}
                  </CardTitle>
                  <CardDescription>文本内容</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`h-3 w-3 rounded-full ${(textInputMode === "direct" && textContent.trim()) || (textInputMode === "file" && selectedTextFile) ? "bg-green-500" : "bg-muted-foreground"}`} />
                  <Badge variant={(textInputMode === "direct" && textContent.trim()) || (textInputMode === "file" && selectedTextFile) ? "default" : "secondary"} className="text-xs">
                    {textInputMode === "direct" ? "直接输入" : "文件上传"}
                  </Badge>
                </div>
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
                  上传音频文件和对应的文本内容进行时间戳预测
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Audio File Upload */}
                <div>
                  <label className="block text-sm font-medium mb-2">音频文件</label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                    <input
                      id="audio-input"
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileSelect}
                      className="hidden"
                    />
                    <div className="text-center">
                      <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div className="mt-4">
                        <label
                          htmlFor="audio-input"
                          className="cursor-pointer inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
                        >
                          选择音频文件
                        </label>
                      </div>
                      {selectedAudioFile && (
                        <div className="mt-4 text-sm text-muted-foreground">
                          <p>已选择: {selectedAudioFile.name}</p>
                          <p>大小: {formatFileSize(selectedAudioFile.size)}</p>
                          <p>类型: {selectedAudioFile.type}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Text Input Mode Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">文本输入方式</label>
                  <div className="flex items-center space-x-1 rounded-lg bg-muted p-1">
                    <button
                      onClick={() => setTextInputMode("direct")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        textInputMode === "direct"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      直接输入
                    </button>
                    <button
                      onClick={() => setTextInputMode("file")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        textInputMode === "file"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      文件上传
                    </button>
                  </div>
                </div>

                {/* Text Input */}
                {textInputMode === "direct" ? (
                  <div>
                    <label className="block text-sm font-medium mb-2">文本内容</label>
                    <textarea
                      value={textContent}
                      onChange={handleTextInputChange}
                      placeholder="请输入与音频对应的文本内容..."
                      className="w-full p-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[120px] resize-y"
                    />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {textContent.length} 字符
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-2">文本文件</label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                      <input
                        id="text-input"
                        type="file"
                        accept=".txt,.text,.md,.json,.html,.css,.js"
                        onChange={handleTextFileSelect}
                        className="hidden"
                      />
                      <div className="text-center">
                        <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                        <div className="mt-4">
                          <label
                            htmlFor="text-input"
                            className="cursor-pointer inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
                          >
                            选择文本文件
                          </label>
                        </div>
                        {selectedTextFile && (
                          <div className="mt-4 text-sm text-muted-foreground">
                            <p>已选择: {selectedTextFile.name}</p>
                            <p>大小: {formatFileSize(selectedTextFile.size)}</p>
                            <p>类型: {selectedTextFile.type}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <Button
                    onClick={handlePredict}
                    disabled={isLoading || !selectedAudioFile || (!textContent.trim() && !selectedTextFile)}
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
                        开始预测
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
              </CardContent>
            </Card>

            {/* Results Panel */}
            {results.length > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>预测结果</CardTitle>
                      <CardDescription>
                        共生成 {results.length} 个时间戳片段
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const resultText = results.map(r =>
                            `[${TimestampAPI.formatTime(r.start)} - ${TimestampAPI.formatTime(r.end)}] ${r.text}`
                          ).join('\n');
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
                        文本片段的时间分布 (点击片段查看详情)
                      </p>
                    </div>

                    {/* Timeline */}
                    <div className="relative">
                      {(() => {
                        const maxTime = getTotalDuration();
                        const timelineWidth = 100; // percentage

                        if (maxTime === 0) {
                          return (
                            <div className="text-center py-8 text-muted-foreground">
                              无有效的时间数据
                            </div>
                          );
                        }

                        return (
                          <div>
                            {/* Time labels */}
                            <div className="relative h-8 mb-2">
                              <div className="absolute inset-0 flex justify-between text-xs text-muted-foreground">
                                <span>0:00</span>
                                <span>{TimestampAPI.formatTime(maxTime / 2)}</span>
                                <span>{TimestampAPI.formatTime(maxTime)}</span>
                              </div>
                            </div>

                            {/* Timeline bar */}
                            <div className="relative h-12 bg-background border rounded-lg overflow-hidden">
                              <div className="absolute inset-0 flex items-center px-2">
                                {results.map((segment, index) => {
                                  const left = (segment.start / maxTime) * timelineWidth;
                                  const width = ((segment.end - segment.start) / maxTime) * timelineWidth;
                                  const confidence = segment.confidence;

                                  return (
                                    <div
                                      key={index}
                                      className={`absolute h-8 rounded cursor-pointer transition-all hover:scale-y-110 flex items-center justify-center text-xs text-primary-foreground font-medium ${
                                        confidence > 0.8 ? "bg-green-600" : confidence > 0.6 ? "bg-yellow-600" : "bg-red-600"
                                      } hover:opacity-90`}
                                      style={{
                                        left: left + "%",
                                        width: width + "%",
                                        minWidth: width < 1 ? "2px" : undefined
                                      }}
                                      title={`片段 ${index + 1}: ${TimestampAPI.formatTime(segment.start)} - ${TimestampAPI.formatTime(segment.end)} (置信度: ${(confidence * 100).toFixed(1)}%)\n内容: ${segment.text}`}
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
                                <div className="w-3 h-3 bg-green-600 rounded mr-2"></div>
                                <span>高置信度 (&gt;80%)</span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-3 h-3 bg-yellow-600 rounded mr-2"></div>
                                <span>中置信度 (60-80%)</span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-3 h-3 bg-red-600 rounded mr-2"></div>
                                <span>低置信度 (&lt;60%)</span>
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
                        所有的时间戳预测结果
                      </p>
                    </div>
                    <div className="space-y-2">
                      {results.map((segment, index) => (
                        <div key={index} className="text-sm leading-relaxed p-3 bg-background rounded border hover:border-primary/50 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-xs">
                              片段 {index + 1}
                            </Badge>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                {TimestampAPI.formatTime(segment.start)} - {TimestampAPI.formatTime(segment.end)}
                              </Badge>
                              <Badge variant={segment.confidence > 0.8 ? "default" : segment.confidence > 0.6 ? "secondary" : "destructive"} className="text-xs">
                                {(segment.confidence * 100).toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                          <p className="text-foreground">{segment.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary">{stats.totalSegments}</div>
                        <div className="text-xs text-muted-foreground">总片段数</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary">
                          {TimestampAPI.formatDuration(stats.totalDuration)}
                        </div>
                        <div className="text-xs text-muted-foreground">总时长</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary">
                          {TimestampAPI.formatDuration(stats.avgDuration)}
                        </div>
                        <div className="text-xs text-muted-foreground">平均时长</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary">
                          {(stats.avgConfidence * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">平均置信度</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex items-center text-sm text-muted-foreground">
                    <InfoIcon className="mr-2 h-4 w-4" />
                    <span>时间戳预测完成</span>
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
                    <h3 className="mt-4 text-lg font-semibold">准备开始预测</h3>
                    <p className="text-sm text-muted-foreground">
                      上传音频文件和文本内容，点击"开始预测"进行时间戳预测
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <ModelManagementCard
              requiredModel="timestamp"
              compact={false}
              showLoadButton={true}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">功能说明</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>• 音频文本时间戳对齐</p>
                  <p>• 高精度时间定位</p>
                  <p>• 置信度评估</p>
                  <p>• 支持多种输入方式</p>
                  <p>• 可视化时间轴</p>
                  <p>• 详细统计信息</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">支持格式</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="text-sm font-medium mb-1">音频格式:</div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    <Badge variant="outline" className="text-xs">WAV</Badge>
                    <Badge variant="outline" className="text-xs">MP3</Badge>
                    <Badge variant="outline" className="text-xs">M4A</Badge>
                    <Badge variant="outline" className="text-xs">FLAC</Badge>
                    <Badge variant="outline" className="text-xs">OGG</Badge>
                  </div>
                  <div className="text-sm font-medium mb-1">文本格式:</div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">TXT</Badge>
                    <Badge variant="outline" className="text-xs">MD</Badge>
                    <Badge variant="outline" className="text-xs">JSON</Badge>
                    <Badge variant="outline" className="text-xs">HTML</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">技术参数</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>模型: fa-zh</p>
                  <p>时间精度: 毫秒级</p>
                  <p>置信度: 0-1.0</p>
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
