import { ComponentProps } from "preact";

interface BaseIconProps extends Omit<ComponentProps<"svg">, "width" | "height"> {
  size?: string | number;
  width?: string | number;
  height?: string | number;
}

export function BaseIcon({
  size,
  width = size || "1em",
  height = size || "1em",
  className = "",
  children,
  ...props
}: BaseIconProps) {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export type IconProps = Omit<ComponentProps<"svg">, "width" | "height"> & {
  size?: string | number;
};

// Export all icon components
export { ErrorIcon } from "./ErrorIcon";
export { SpinnerIcon } from "./SpinnerIcon";
export { CheckIcon } from "./CheckIcon";
export { TrashIcon } from "./TrashIcon";
export { InfoIcon } from "./InfoIcon";
export { CopyIcon } from "./CopyIcon";
export { MicrophoneIcon } from "./MicrophoneIcon";
export { DownloadIcon } from "./DownloadIcon";
export { PlayIcon } from "./PlayIcon";
export { StopIcon } from "./StopIcon";
export { UploadIcon } from "./UploadIcon";
export { PencilIcon } from "./PencilIcon";