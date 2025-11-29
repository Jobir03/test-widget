import "./ImageGenerationLoader.css";
import { Image } from "lucide-react";
import { useEffect, useState } from "react";

interface ImageGenerationLoaderProps {
  message?: string;
}

// Additional progressive status messages shown as loading takes longer
const EXTRA_STATUS_MESSAGES = [
  "Processing room details",
  "Detecting interior design style",
  "Extracting room color palette",
  "Estimating floor area",
];

export function ImageGenerationLoader({
  message = "Generating your room image",
}: ImageGenerationLoaderProps) {
  // 0: base message, then EXTRA_STATUS_MESSAGES in order
  const messages = [message, ...EXTRA_STATUS_MESSAGES];
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Reset to first message whenever the component mounts
    setCurrentIndex(0);

    const timeouts: number[] = [];

    // Only schedule if we actually have the next message
    if (messages.length > 1) {
      // After 5s -> show "Processing room details"
      timeouts.push(
        window.setTimeout(() => {
          setCurrentIndex((prev) => (messages[1] ? 1 : prev));
        }, 5000)
      );
    }

    if (messages.length > 2) {
      // After 9s -> show "Detecting interior design style"
      timeouts.push(
        window.setTimeout(() => {
          setCurrentIndex((prev) => (messages[2] ? 2 : prev));
        }, 9000)
      );
    }

    if (messages.length > 3) {
      // After 13s -> show "Extracting room color palette"
      timeouts.push(
        window.setTimeout(() => {
          setCurrentIndex((prev) => (messages[3] ? 3 : prev));
        }, 13000)
      );
    }

    if (messages.length > 4) {
      // After 18s -> show "Estimating floor area"
      timeouts.push(
        window.setTimeout(() => {
          setCurrentIndex((prev) => (messages[4] ? 4 : prev));
        }, 18000)
      );
    }

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
    };
    // We intentionally *don't* include `messages` in deps to avoid restarting
    // timers on every re-render; it is stable for the lifetime of the loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            {messages[currentIndex]}
            <span className="fcw-loader-dots-animation"></span>
          </p>
        </div>
      </div>
    </div>
  );
}
