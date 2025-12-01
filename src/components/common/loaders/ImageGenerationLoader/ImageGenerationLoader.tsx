import "./ImageGenerationLoader.css";
import { Image } from "lucide-react";
import { useProgressiveMessages } from "../../../../hooks/useProgressiveMessages";

interface ImageGenerationLoaderProps {
  message?: string;
}

// Additional progressive status messages shown as loading takes longer
const EXTRA_STATUS_MESSAGES = [
  "Measuring the floor",
  "Defining the best position",
  "Matching styles and decor",
  "Generating your design, almost done",
];

// Timeouts for each message transition (in milliseconds)
const MESSAGE_TIMEOUTS = [5000, 9000, 16000, 20000];

export function ImageGenerationLoader({
  message = "Generating your room image",
}: ImageGenerationLoaderProps) {
  // 0: base message, then EXTRA_STATUS_MESSAGES in order
  const messages = [message, ...EXTRA_STATUS_MESSAGES];

  const { currentMessage, currentIndex } = useProgressiveMessages({
    messages,
    timeouts: MESSAGE_TIMEOUTS,
  });

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

        <div className="fcw-loader-message-wrapper">
          <p
            key={currentIndex}
            className="fcw-loader-message fcw-loader-message-anim"
          >
            {currentMessage}
            <span className="fcw-loader-dots-animation"></span>
          </p>
        </div>
      </div>
    </div>
  );
}
