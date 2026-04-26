// src/components/ui/textarea.tsx
import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:opacity-50 transition-colors",
        className
      )}
      {...props}
    />
  );
}