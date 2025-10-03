import { useState } from "preact/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ModelManagementCard } from "@/components/ModelManagementCard";
import { API_BASE_URL, API_ENDPOINTS } from "@/lib/config";
import { ErrorIcon, SpinnerIcon, CheckIcon, TrashIcon, InfoIcon, CopyIcon } from "@/components/icons";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function Punctuation() {
  useDocumentTitle("智能标点添加");
  const [inputText, setInputText] = useState("");
  const [resultText, setResultText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAddPunctuation = async () => {
    if (!inputText.trim()) {
      setError("请输入需要添加标点的文本");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.PUNCTUATE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: inputText }),
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const data = await response.json();
      setResultText(data.punctuated_text || inputText);
    } catch (err) {
      setError(`添加标点失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setInputText("");
    setResultText("");
    setError("");
  };

  const handleExampleText = (text: string) => {
    setInputText(text);
    setError("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            标点添加
          </h1>
          <p className="text-muted-foreground">
            基于AI的智能标点符号自动添加功能
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {inputText.length}
                  </CardTitle>
                  <CardDescription>输入字符数</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <Badge variant="secondary" className="text-xs">
                    输入
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
                    {resultText.length}
                  </CardTitle>
                  <CardDescription>输出字符数</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <Badge variant="default" className="text-xs">
                    输出
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

            {/* Input Panel */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>输入文本</CardTitle>
                <CardDescription>
                  请输入需要添加标点符号的中文文本
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.currentTarget.value)}
                    placeholder="在这里输入需要添加标点的文本..."
                    className="w-full min-h-[200px] p-4 border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <div className="flex gap-4">
                    <Button
                      onClick={handleAddPunctuation}
                      disabled={isLoading || !inputText.trim()}
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
                          添加标点
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
            {resultText && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>添加结果</CardTitle>
                  <CardDescription>
                    已自动添加标点符号的文本
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-muted p-6 min-h-[200px]">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {resultText}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <InfoIcon className="mr-2 h-4 w-4" />
                      <span>标点添加完成</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(resultText);
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
            {!resultText && !error && !isLoading && (
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    <h3 className="mt-4 text-lg font-semibold">准备添加标点</h3>
                    <p className="text-sm text-muted-foreground">
                      在上方输入文本，点击"添加标点"按钮进行处理
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">示例文本</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <a
                    href="#"
                    onClick={() => handleExampleText("今天天气真好我们一起去公园玩吧")}
                    className="block rounded-md text-sm font-medium hover:text-foreground/80 hover:bg-muted p-2 transition-colors"
                  >
                    今天天气真好我们一起去公园玩吧
                  </a>
                  <Separator />
                  <a
                    href="#"
                    onClick={() => handleExampleText("你好请问这个产品怎么卖多少钱")}
                    className="block rounded-md text-sm font-medium hover:text-foreground/80 hover:bg-muted p-2 transition-colors"
                  >
                    你好请问这个产品怎么卖多少钱
                  </a>
                  <Separator />
                  <a
                    href="#"
                    onClick={() => handleExampleText("我需要预订一张明天去上海的机票谢谢")}
                    className="block rounded-md text-sm font-medium hover:text-foreground/80 hover:bg-muted p-2 transition-colors"
                  >
                    我需要预订一张明天去上海的机票谢谢
                  </a>
                </div>
              </CardContent>
            </Card>

            <ModelManagementCard
              requiredModel="punctuation"
              compact={false}
              showLoadButton={true}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">功能说明</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>• 自动识别句子边界</p>
                  <p>• 智能添加标点符号</p>
                  <p>• 支持中英文混合</p>
                  <p>• 保持原有格式</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">支持标点</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">。</Badge>
                  <Badge variant="outline" className="text-xs">，</Badge>
                  <Badge variant="outline" className="text-xs">？</Badge>
                  <Badge variant="outline" className="text-xs">！</Badge>
                  <Badge variant="outline" className="text-xs">；</Badge>
                  <Badge variant="outline" className="text-xs">：</Badge>
                  <Badge variant="outline" className="text-xs">、</Badge>
                  <Badge variant="outline" className="text-xs">...</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
