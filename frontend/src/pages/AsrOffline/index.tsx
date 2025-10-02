import { useState } from "preact/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ModelManagementCard } from "@/components/ModelManagementCard";

export function AsrOffline() {
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
      // Upload file
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadResponse = await fetch("/offline/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`文件上传失败: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();

      // Perform recognition
      const recognitionFormData = new FormData();
      recognitionFormData.append("file_path", uploadData.file_path);
      if (hotword.trim()) {
        recognitionFormData.append("hotword", hotword.trim());
      }

      const recognitionResponse = await fetch("/offline/recognize", {
        method: "POST",
        body: recognitionFormData,
      });

      if (!recognitionResponse.ok) {
        throw new Error(`语音识别失败: ${recognitionResponse.status}`);
      }

      const recognitionData = await recognitionResponse.json();

      if (recognitionData.success && recognitionData.results) {
        // Format results for display
        const formattedResults = recognitionData.results.map((item: any) => {
          if (typeof item === 'string') {
            return item;
          } else if (item.text) {
            return item.text;
          }
          return JSON.stringify(item);
        }).join('\n\n');

        setResult(formattedResults);
      } else {
        throw new Error(recognitionData.message || "识别失败");
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
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
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
                      <svg
                        className="mx-auto h-12 w-12 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
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
                          <svg
                            className="mr-2 h-4 w-4 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          处理中
                        </>
                      ) : (
                        <>
                          <svg
                            className="mr-2 h-4 w-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
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
                      <svg
                        className="mr-2 h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
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
                      <svg
                        className="mr-2 h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>离线识别完成</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(result);
                      }}
                    >
                      <svg
                        className="mr-2 h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
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
                    <svg
                      className="h-12 w-12 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
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
