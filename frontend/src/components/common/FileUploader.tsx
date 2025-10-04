import { useState } from "preact/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UploadIcon, ErrorIcon, CheckIcon } from "@/components/icons";
import { formatFileSize } from "@/lib/format";

interface FileUploaderProps {
  accept?: string; // 文件类型限制，如 ".wav,.mp3"
  multiple?: boolean;
  maxSize?: number; // 最大文件大小（字节）
  onFilesSelected?: (files: File[]) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode; // 自定义上传区域内容
}

export function FileUploader({
  accept,
  multiple = false,
  maxSize = 100 * 1024 * 1024, // 默认 100MB
  onFilesSelected,
  onError,
  className = "",
  disabled = false,
  children
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const validateFile = (file: File): string | null => {
    // 检查文件大小
    if (file.size > maxSize) {
      return `文件 "${file.name}" 太大，最大允许 ${formatFileSize(maxSize)}`;
    }

    // 检查文件类型（如果指定了 accept）
    if (accept) {
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const isValidType = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type.toLowerCase();
        }
        return file.type.includes(type);
      });

      if (!isValidType) {
        return `文件 "${file.name}" 格式不支持，请选择 ${accept} 格式的文件`;
      }
    }

    return null;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    // 如果有错误，显示第一个错误
    if (errors.length > 0 && onError) {
      onError(errors[0]);
    }

    // 如果有有效文件，更新状态并回调
    if (validFiles.length > 0) {
      const newFiles = multiple ? [...uploadedFiles, ...validFiles] : validFiles;
      setUploadedFiles(newFiles);
      if (onFilesSelected) {
        onFilesSelected(newFiles);
      }
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer?.files);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    handleFiles(target.files);
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    if (onFilesSelected) {
      onFilesSelected(newFiles);
    }
  };

  const clearFiles = () => {
    setUploadedFiles([]);
    if (onFilesSelected) {
      onFilesSelected([]);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 拖拽上传区域 */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        onDrop={disabled ? undefined : handleDrop}
        onDragOver={disabled ? undefined : handleDragOver}
        onDragLeave={disabled ? undefined : handleDragLeave}
        onClick={() => {
          if (!disabled) {
            document.getElementById('file-input')?.click();
          }
        }}
      >
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <input
            id="file-input"
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled}
          />

          {children || (
            <>
              <UploadIcon className="w-10 h-10 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {isDragging ? "释放文件以上传" : "拖拽文件到此处或点击选择"}
              </p>
              <p className="text-sm text-muted-foreground">
                {accept && `支持格式: ${accept}`}
                {!multiple && "单个文件"}
                {multiple && "多个文件"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                最大文件大小: {formatFileSize(maxSize)}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 已上传文件列表 */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">已选择文件</h4>
            <Button variant="ghost" size="sm" onClick={clearFiles}>
              清除全部
            </Button>
          </div>

          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <CheckIcon className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}