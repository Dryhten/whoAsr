import { useState } from "preact/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckIcon, CopyIcon, DownloadIcon, TrashIcon, ErrorIcon, InfoIcon } from "@/components/icons";
import { formatFileSize } from "@/lib/format";

interface ResultDisplayProps<T = any> {
  title: string;
  description?: string;
  data?: T | null;
  isLoading?: boolean;
  error?: string | null;
  onClear?: () => void;
  onRetry?: () => void;
  actions?: React.ReactNode;
  children?: (data: T) => React.ReactNode;
  emptyMessage?: string;
}

export function ResultDisplay<T = any>({
  title,
  description,
  data,
  isLoading = false,
  error = null,
  onClear,
  onRetry,
  actions,
  children,
  emptyMessage = "暂无数据"
}: ResultDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleDownload = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 加载状态
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
            处理中...
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Alert variant="destructive">
        <ErrorIcon className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          {onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              重试
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // 无数据状态
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-muted-foreground">
            <InfoIcon className="h-4 w-4 mr-2" />
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  // 有数据状态
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
              {title}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex items-center space-x-2">
            {actions}
            {onClear && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                <TrashIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {children ? (
          children(data)
        ) : (
          <div className="space-y-4">
            {/* 默认显示 JSON 格式 */}
            <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(data, null, 2)}
            </pre>

            {/* 默认操作按钮 */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(JSON.stringify(data, null, 2))}
              >
                <CopyIcon className="h-4 w-4 mr-2" />
                {copied ? "已复制" : "复制"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(JSON.stringify(data, null, 2), `${title}.json`)}
              >
                <DownloadIcon className="h-4 w-4 mr-2" />
                下载
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 专门用于显示文本结果的组件
export function TextResultDisplay({
  title,
  description,
  text,
  isLoading,
  error,
  onClear,
  onRetry,
  showWordCount = true
}: {
  title: string;
  description?: string;
  text?: string | null;
  isLoading?: boolean;
  error?: string | null;
  onClear?: () => void;
  onRetry?: () => void;
  showWordCount?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleDownload = () => {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ResultDisplay
      title={title}
      description={description}
      data={text}
      isLoading={isLoading}
      error={error}
      onClear={onClear}
      onRetry={onRetry}
      emptyMessage="暂无文本结果"
    >
      {(data: string) => (
        <div className="space-y-4">
          {/* 字数统计 */}
          {showWordCount && (
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <Badge variant="outline">
                字符数: {data.length}
              </Badge>
              <Badge variant="outline">
                词数: {data.split(/\s+/).filter(word => word.length > 0).length}
              </Badge>
              <Badge variant="outline">
                行数: {data.split('\n').length}
              </Badge>
            </div>
          )}

          {/* 文本内容 */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">
              {data}
            </pre>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <CopyIcon className="h-4 w-4 mr-2" />
              {copied ? "已复制" : "复制"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <DownloadIcon className="h-4 w-4 mr-2" />
              下载
            </Button>
          </div>
        </div>
      )}
    </ResultDisplay>
  );
}

// 专门用于显示文件信息的组件
export function FileInfoDisplay({
  file,
  onRemove
}: {
  file: File;
  onRemove?: () => void;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckIcon className="w-4 h-4 text-green-500" />
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>
          {onRemove && (
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <TrashIcon className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}