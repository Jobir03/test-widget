import { useProgressiveMessages } from "../../../../hooks/useProgressiveMessages";
import "./TypingAnimation.css";

interface TypingAnimationProps {
  mode?: "dots" | "text";
  messages?: string[];
  timeouts?: number[];
}

export function TypingAnimation({
  mode = "dots",
  messages = [],
  timeouts = [6000, 12000, 20000, 30000, 40000, 45000],
}: TypingAnimationProps) {
  const { currentMessage } = useProgressiveMessages({
    messages: messages || [],
    timeouts,
    autoStart: mode === "text" && (messages?.length ?? 0) > 0,
  });

  if (mode === "text" && messages && messages.length > 0) {
    return (
      <div className="fcw-typing-row">
        <div className="fcw-typing-bubble">
          <div className="fcw-typing-text">
            {currentMessage}
            <span className="fcw-typing-dots-animation">...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fcw-typing-row">
      <div className="fcw-typing-bubble">
        <span className="fcw-typing">
          <span className="fcw-typing-dot" />
          <span className="fcw-typing-dot" />
          <span className="fcw-typing-dot" />
        </span>
      </div>
    </div>
  );
}
