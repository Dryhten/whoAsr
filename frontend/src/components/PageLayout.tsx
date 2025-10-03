/**
 * 通用的页面布局组件
 * 遵循KISS原则：统一页面布局，减少重复代码
 */

import { ReactNode } from 'preact/compat';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ModelManagementCard } from '@/components/ModelManagementCard';

interface PageLayoutProps {
  title: string;
  description?: string;
  requiredModel?: string;
  modelDescription?: string;
  error?: string;
  isLoading?: boolean;
  children: ReactNode;
  extraActions?: ReactNode;
}

export function PageLayout({
  title,
  description,
  requiredModel,
  modelDescription,
  error,
  isLoading = false,
  children,
  extraActions,
}: PageLayoutProps) {
  // 如果有错误，显示错误提示
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // 如果需要模型管理，显示模型管理卡片
  const content = requiredModel ? (
    <div className="space-y-6">
      <ModelManagementCard
        requiredModel={requiredModel}
        title={title}
        description={modelDescription}
        extraActions={extraActions}
      />
      {children}
    </div>
  ) : (
    children
  );

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-2">{description}</p>
        )}
      </div>
      {content}
    </div>
  );
}