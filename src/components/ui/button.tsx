import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "default" | "small";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function getButtonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "default",
  fullWidth = false,
) {
  return cn(
    "btn",
    `btn--${variant}`,
    size === "small" && "btn--small",
    fullWidth && "btn--full",
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  size = "default",
  fullWidth = false,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(getButtonClassName(variant, size, fullWidth), className)}
      {...props}
    >
      {children}
    </button>
  );
}
