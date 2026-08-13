"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";

interface IframeEmbedProps {
  src: string;
  title: string;
  className?: string;
}

export const IframeEmbed: React.FC<IframeEmbedProps> = ({ src, title, className = "" }) => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-surface z-10 animate-pulse">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-text-secondary font-medium animate-pulse">
            Connecting to {title}...
          </p>
        </div>
      )}
      <iframe
        src={src}
        title={title}
        className={`w-full h-full border-0 transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        onLoad={() => setIsLoading(false)}
        allow="microphone; camera; display-capture; autoplay; clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
};
