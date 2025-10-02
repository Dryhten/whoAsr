import { useState } from "preact/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ModelManagementCard } from "@/components/ModelManagementCard";

export function Punctuation() {
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
      const response = await fetch("/punctuation/add", {
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
                      <span>标点添加完成</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(resultText);
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
