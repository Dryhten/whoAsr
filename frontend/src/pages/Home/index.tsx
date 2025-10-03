import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MicrophoneIcon, UploadIcon, CheckIcon, InfoIcon } from "@/components/icons";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function Home() {
  useDocumentTitle("首页");
  const features = [
    {
      icon: <MicrophoneIcon className="h-8 w-8 text-blue-600" />,
      title: "实时语音识别",
      description: "基于FunASR的流式语音识别，支持WebSocket实时传输，毫秒级响应"
    },
    {
      icon: <UploadIcon className="h-8 w-8 text-green-600" />,
      title: "离线文件处理",
      description: "支持多种音频格式批量处理，保护隐私的同时提供高精度识别"
    },
    {
      icon: <CheckIcon className="h-8 w-8 text-purple-600" />,
      title: "智能标点添加",
      description: "AI驱动的自动标点符号添加，提升文本可读性和专业性"
    },
    {
      icon: <InfoIcon className="h-8 w-8 text-orange-600" />,
      title: "时间戳预测",
      description: "精准的语音文本时间对齐，适用于字幕制作和内容分析"
    }
  ];

  const techStack = [
    { name: "FunASR", description: "阿里巴巴开源语音识别框架" },
    { name: "FastAPI", description: "高性能异步Web框架" },
    { name: "WebSocket", description: "实时双向通信协议" },
    { name: "Preact", description: "轻量级前端框架" },
    { name: "TypeScript", description: "类型安全的JavaScript" },
    { name: "Tailwind CSS", description: "实用优先的CSS框架" }
  ];

  const quickLinks = [
    { title: "实时语音识别", description: "体验流式语音识别功能", href: "/asr" },
    { title: "离线识别", description: "上传音频文件进行识别", href: "/asr-offline" },
    { title: "标点添加", description: "为文本添加智能标点", href: "/punctuation" },
    { title: "时间戳预测", description: "语音文本时间对齐", href: "/timestamp" },
    { title: "语音端点检测", description: "检测语音活动片段", href: "/vad" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-8">
              <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-2xl">
                <MicrophoneIcon className="h-16 w-16 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              whoAsr
              <span className="block text-2xl md:text-3xl font-normal text-muted-foreground mt-2">
                智能语音识别平台
              </span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              基于FunASR构建的高性能中文语音识别系统，提供实时流式识别、
              离线批量处理、智能标点添加等全方位语音处理能力。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" className="text-lg px-8 py-3" asChild>
                <a href="/asr">开始体验</a>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-3" asChild>
                <a href="/asr-offline">离线处理</a>
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="secondary">实时识别</Badge>
              <Badge variant="secondary">离线处理</Badge>
              <Badge variant="secondary">智能标点</Badge>
              <Badge variant="secondary">时间戳对齐</Badge>
              <Badge variant="secondary">语音检测</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              核心功能
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              提供完整的语音处理解决方案，从实时识别到批量处理，满足各种应用场景
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              快速开始
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              选择您需要的功能，立即体验智能语音处理的强大能力
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {quickLinks.map((link, index) => (
              <Card key={index} className="hover:shadow-lg transition-all hover:scale-105">
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">{link.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription className="mb-4">{link.description}</CardDescription>
                  <Button variant="outline" size="sm" asChild>
                    <a href={link.href}>立即使用</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              技术栈
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              基于现代化技术栈构建，确保高性能和可靠性
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {techStack.map((tech, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 bg-background rounded-lg border">
                <div className="flex-shrink-0">
                  <div className="w-3 h-3 bg-primary rounded-full"></div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{tech.name}</h3>
                  <p className="text-sm text-muted-foreground">{tech.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                准备开始使用了吗？
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                立即体验whoAsr的强大功能，让语音处理变得简单高效。
                支持实时流式识别和离线批量处理，满足您的各种需求。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="text-lg px-8 py-3" asChild>
                  <a href="/asr">开始实时识别</a>
                </Button>
                <Button variant="outline" size="lg" className="text-lg px-8 py-3" asChild>
                  <a href="/asr-offline">上传文件处理</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <MicrophoneIcon className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">whoAsr</span>
            </div>
            <p className="text-muted-foreground">
              基于FunASR的智能语音识别平台
            </p>
            <div className="flex items-center justify-center space-x-4 mt-4 text-sm text-muted-foreground">
              <span>实时语音识别</span>
              <Separator orientation="vertical" className="h-4" />
              <span>离线批量处理</span>
              <Separator orientation="vertical" className="h-4" />
              <span>智能标点添加</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}