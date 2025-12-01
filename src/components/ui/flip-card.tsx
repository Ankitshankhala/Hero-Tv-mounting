import * as React from "react";
import { cn } from "@/lib/utils";

interface FlipCardProps {
  frontContent: React.ReactNode;
  backContent: React.ReactNode;
  className?: string;
}

export const FlipCard = ({ frontContent, backContent, className }: FlipCardProps) => {
  return (
    <div className={cn("group [perspective:1000px]", className)}>
      <div className="relative h-full w-full transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
        {/* Front Face */}
        <div className="h-full w-full [backface-visibility:hidden]">
          {frontContent}
        </div>
        {/* Back Face */}
        <div className="absolute inset-0 h-full w-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {backContent}
        </div>
      </div>
    </div>
  );
};
