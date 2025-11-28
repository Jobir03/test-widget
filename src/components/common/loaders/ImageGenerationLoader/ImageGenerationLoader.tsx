import "./ImageGenerationLoader.css";
import { Image } from "lucide-react";

interface ImageGenerationLoaderProps {
  message?: string;
}

export function ImageGenerationLoader({
  message = "Generating your room image",
}: ImageGenerationLoaderProps) {
  return (
    <div className="fcw-image-generation-loader-card">
      <div className="fcw-image-generation-content">
        <div className="fcw-creative-loader">
          <div className="fcw-loader-ring"></div>
          <div className="fcw-loader-ring-inner">
            <div className="fcw-loader-icon-wrapper">
              <Image className="fcw-loader-icon" size={32} strokeWidth={1} />
            </div>
          </div>
        </div>

        <p className="fcw-loader-message">
          {message}
          <span className="fcw-loader-dots-animation"></span>
        </p>
      </div>
    </div>
  );
}
