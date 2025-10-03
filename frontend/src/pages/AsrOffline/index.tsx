import { useState } from "preact/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ModelManagementCard } from "@/components/ModelManagementCard";
import { RecognitionAPI } from "@/api";
import { ErrorIcon, SpinnerIcon, CheckIcon, TrashIcon, InfoIcon, CopyIcon, UploadIcon, PencilIcon } from "@/components/icons";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function AsrOffline() {
  useDocumentTitle("离线语音识别");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hotword, setHotword] = useState("");

  const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      setSelectedFile(file);
      setError("");
      setResult("");
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
      const response = await RecognitionAPI.recognizeFile(
        selectedFile,
        300, // batchSizeS
        60, // batchSizeThresholdS
        hotword.trim() || undefined
      );

      if (response.success && response.results) {
        // Format results for display
        const formattedResults = response.results.map((item: any) => {
          if (typeof item === 'string') {
            return item;
          } else if (item.text) {
            return item.text;
          }
          return JSON.stringify(item);
        }).join('\n\n');

        setResult(formattedResults);
      } else {
        throw new Error(response.message || "识别失败");
      }

    } catch (err) {
      setError(`处理失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setResult("");
    setError("");
    setHotword("");
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            ASR - 离线语音识别
          </h1>
          <p className="text-muted-foreground">
            基于FunASR的高精度离线中文语音识别系统
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
                  选择音频文件进行离线语音识别 (支持 WAV, MP3, M4A, FLAC, OGG)
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

                  {/* Hotword Input */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      热词 (可选)
                    </label>
                    <input
                      type="text"
                      value={hotword}
                      onChange={(e) => setHotword(e.currentTarget.value)}
                      placeholder="输入热词以提高识别准确率"
                      className="w-full p-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
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
                          开始识别
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
            {result && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>识别结果</CardTitle>
                  <CardDescription>
                    离线语音识别的完整结果
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-muted p-6 min-h-[200px]">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {result}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <InfoIcon className="mr-2 h-4 w-4" />
                      <span>离线识别完成</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(result);
                      }}
                    >
                      <CopyIcon className="mr-2 h-4 w-4" />
                      复制
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!result && !error && !isLoading && (
              <Card className="border-dashed">
                <CardContent className="flex h-[400px] flex-col items-center justify-center p-6">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <PencilIcon className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">准备上传文件</h3>
                    <p className="text-sm text-muted-foreground">
                      选择音频文件，点击"开始识别"进行离线语音识别
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <ModelManagementCard
              requiredModel="offline_asr"
              compact={false}
              showLoadButton={true}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">功能说明</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>• 支持多种音频格式</p>
                  <p>• 离线处理，保护隐私</p>
                  <p>• 高精度中文识别</p>
                  <p>• 自动添加标点符号</p>
                  <p>• 支持热词优化</p>
                  <p>• 说话人分离识别</p>
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
                <CardTitle className="text-base">处理参数</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>批处理大小: 300秒</p>
                  <p>批处理阈值: 60秒</p>
                  <p>VAD分段: 60秒</p>
                  <p>模型: paraformer-zh</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
