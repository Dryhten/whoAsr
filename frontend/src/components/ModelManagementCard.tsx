import { useState, useEffect } from "preact/hooks";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { API_BASE_URL, API_ENDPOINTS } from "@/lib/config";

interface ModelStatus {
  loaded: boolean;
  display_name: string;
  description: string;
  auto_load: boolean;
}

interface ModelStatusData {
  models: Record<string, ModelStatus>;
  total_loaded: number;
  available_models: Record<string, any>;
}

interface ModelManagementCardProps {
  /** 当前页面需要的模型类型 */
  requiredModel: string;
  /** 卡片标题，如果不指定则使用模型显示名称 */
  title?: string;
  /** 卡片描述 */
  description?: string;
  /** 是否显示紧凑模式 */
  compact?: boolean;
  /** 是否显示加载按钮 */
  showLoadButton?: boolean;
  /** 模型加载完成后的回调 */
  onModelLoaded?: (modelType: string) => void;
  /** 额外的操作按钮 */
  extraActions?: React.ReactNode;
  /** 是否自动轮询状态 */
  autoPoll?: boolean;
}

export function ModelManagementCard({
  requiredModel,
  title,
  description,
  compact = false,
  showLoadButton = true,
  onModelLoaded,
  extraActions,
  autoPoll = true,
}: ModelManagementCardProps) {
  const [modelStatus, setModelStatus] = useState<ModelStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchModelStatus = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.MODEL_INFO}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch model info: ${response.status}`);
      }
      const data = await response.json();
      setModelStatus(data);
      setError("");
    } catch (err) {
      setError(`获取模型状态失败: ${err.message}`);
    }
  };

  const loadModel = async (modelType: string) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.MODEL_LOAD}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model_type: modelType }),
        }
      );

      if (!response.ok) {
        throw new Error(`加载模型失败: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Refresh model status
        await fetchModelStatus();
        if (onModelLoaded) {
          onModelLoaded(modelType);
        }
      } else {
        setError(data.message || "加载模型失败");
      }
    } catch (err) {
      setError(`加载模型失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const unloadModel = async (modelType: string) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.MODEL_UNLOAD(modelType)}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(`卸载模型失败: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Refresh model status
        await fetchModelStatus();
      } else {
        setError(data.message || "卸载模型失败");
      }
    } catch (err) {
      setError(`卸载模型失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModelStatus();
    if (autoPoll) {
      // Poll status every 30 seconds
      const interval = setInterval(fetchModelStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [autoPoll]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>模型状态错误</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!modelStatus) {
    return (
      <div className="text-center text-muted-foreground">加载模型状态中...</div>
    );
  }

  const requiredModelStatus = modelStatus.models[requiredModel];
  const requiredModelName =
    modelStatus.available_models[requiredModel]?.display_name || requiredModel;

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{title || "模型状态"}</CardTitle>
            <Badge
              variant={requiredModelStatus?.loaded ? "default" : "secondary"}
            >
              {requiredModelStatus?.loaded ? "已加载" : "未加载"}
            </Badge>
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>总模型状态</span>
              <Badge variant="outline">
                {modelStatus.total_loaded} /{" "}
                {Object.keys(modelStatus.models).length}
              </Badge>
            </div>

            {requiredModelStatus &&
              !requiredModelStatus.loaded &&
              showLoadButton && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    需要 {requiredModelName} 模型
                  </p>
                  <Button
                    size="sm"
                    onClick={() => loadModel(requiredModel)}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? "加载中..." : `加载 ${requiredModelName}`}
                  </Button>
                </div>
              )}

            {extraActions && (
              <>
                <Separator />
                {extraActions}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {title || requiredModelName || "模型管理"}
          </CardTitle>
          <Badge
            variant={requiredModelStatus?.loaded ? "default" : "secondary"}
          >
            {requiredModelStatus?.loaded ? "已加载" : "未加载"}
          </Badge>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Required Model Status */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">当前功能所需模型</span>
              <Badge
                variant={
                  requiredModelStatus?.loaded ? "default" : "destructive"
                }
              >
                {requiredModelStatus?.loaded ? "已就绪" : "需要加载"}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    requiredModelStatus?.loaded ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm">{requiredModelName}</span>
              </div>
              {requiredModelStatus?.description && (
                <p className="text-xs text-muted-foreground">
                  {requiredModelStatus.description}
                </p>
              )}
            </div>

            {!requiredModelStatus?.loaded && showLoadButton && (
              <Button
                size="sm"
                onClick={() => loadModel(requiredModel)}
                disabled={isLoading}
                className="w-full mt-2"
              >
                {isLoading ? "加载中..." : `加载 ${requiredModelName}`}
              </Button>
            )}
          </div>

          {/* All Models Status */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">所有模型状态</span>
              <Badge variant="outline">
                {modelStatus.total_loaded} /{" "}
                {Object.keys(modelStatus.models).length}
              </Badge>
            </div>
            <div className="space-y-2">
              {Object.entries(modelStatus.models).map(([type, status]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        status.loaded ? "bg-green-500" : "bg-muted-foreground"
                      }`}
                    />
                    <span className="text-sm">{status.display_name}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Badge
                      variant={status.loaded ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {status.loaded ? "已加载" : "未加载"}
                    </Badge>
                    {!status.loaded && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadModel(type)}
                        disabled={isLoading}
                        className="h-6 px-2 text-xs"
                      >
                        加载
                      </Button>
                    )}
                    {status.loaded && type !== requiredModel && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => unloadModel(type)}
                        disabled={isLoading}
                        className="h-6 px-2 text-xs"
                      >
                        卸载
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {extraActions && (
            <>
              <Separator />
              {extraActions}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
