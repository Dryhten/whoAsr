import { useState } from "preact/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModelManagementCard } from "@/components/ModelManagementCard";
import { VADAPI, VADResponse, VADSegmentList } from "../../api";
import { FileUploader, ResultDisplay } from "@/components/common";
import { formatFileSize, formatVADSegments, formatErrorMessage } from "@/lib/format";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function Vad() {
  useDocumentTitle("语音端点检测");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [results, setResults] = useState<VADSegmentList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedFile = selectedFiles[0] || null;

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - File Upload */}
          <div className="space-y-6">
            <ModelManagementCard requiredModel="vad" title="VAD模型" />

            {/* File Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle>选择音频文件</CardTitle>
                <CardDescription>
                  支持 WAV、MP3、M4A、FLAC、OGG 格式，最大 100MB
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
                      {isLoading ? "检测中..." : "开始检测"}
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
            <ResultDisplay<VADSegmentList[]>
              title="VAD检测结果"
              description="检测到的语音片段时间轴"
              data={results.length > 0 ? results : null}
              isLoading={isLoading}
              error={error || null}
              onClear={handleClear}
              onRetry={handleRetry}
              emptyMessage="请上传音频文件开始检测"
            >
              {(segments: VADSegmentList[]) => (
                <div className="space-y-4">
                  {/* 摘要信息 */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{segments.length}</div>
                          <div className="text-sm text-muted-foreground">检测片段</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {segments.reduce((total, segmentList) => {
                              if (Array.isArray(segmentList) && segmentList.length > 0) {
                                const segment = segmentList[0];
                                if (Array.isArray(segment) && segment.length >= 2) {
                                  const start = segment[0] as number;
                                  const end = segment[1] as number;
                                  return total + (end - start);
                                }
                              }
                              return total;
                            }, 0) / 1000}s
                          </div>
                          <div className="text-sm text-muted-foreground">语音时长</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 可视化时间轴 */}
                  {segments.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">时间轴可视化</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="relative h-24 bg-muted rounded-lg overflow-hidden">
                          {segments.map((segmentList, listIndex) => {
                            if (!Array.isArray(segmentList) || segmentList.length === 0) return null;

                            const segment = segmentList[0];
                            if (!Array.isArray(segment) || segment.length < 2) return null;

                            const [start, end] = segment as number[];
                            const maxDuration = Math.max(...segments.map(list =>
                              Array.isArray(list) && list.length > 0 && Array.isArray(list[0]) && list[0].length >= 2
                                ? (list[0][1] as number) || 0
                                : 0
                            ));
                            const left = (start / maxDuration) * 100;
                            const width = ((end - start) / maxDuration) * 100;
                            const duration = ((end - start) / 1000).toFixed(2);

                            return (
                              <div
                                key={listIndex}
                                className="absolute h-8 bg-primary hover:bg-primary/80 rounded cursor-pointer transition-all hover:scale-y-110 flex items-center justify-center text-xs text-primary-foreground font-medium"
                                style={{
                                  top: `${(listIndex % 3) * 32}px`,
                                  left: `${left}%`,
                                  width: `${width}%`,
                                  minWidth: width < 1 ? '2px' : undefined
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
                        {segments.map((segmentList, listIndex) => {
                          if (!Array.isArray(segmentList) || segmentList.length === 0) {
                            return (
                              <div key={listIndex} className="p-3 bg-muted/50 rounded-lg text-sm">
                                片段 {listIndex + 1}: 数据格式错误
                              </div>
                            );
                          }

                          const segment = segmentList[0];
                          if (!Array.isArray(segment) || segment.length < 2) {
                            return (
                              <div key={listIndex} className="p-3 bg-muted/50 rounded-lg text-sm">
                                片段 {listIndex + 1}: 数据格式错误
                              </div>
                            );
                          }

                          const [start, end] = segment as number[];
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
              )}
            </ResultDisplay>
          </div>
        </div>
      </div>
    </div>
  );
}