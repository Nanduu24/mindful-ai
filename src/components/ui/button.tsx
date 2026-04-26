// src/components/ui/button.tsx
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
          variant === "primary" && "bg-teal-600 text-white hover:bg-teal-700 active:scale-95",
          variant === "ghost" && "text-gray-600 hover:bg-gray-100 active:bg-gray-200",
          variant === "danger" && "text-red-600 hover:bg-red-50 active:bg-red-100",
          size === "sm" && "px-3 py-1.5 text-sm",
          size === "md" && "px-4 py-2 text-sm",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";