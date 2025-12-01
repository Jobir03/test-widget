import { useEffect, useState } from "react";

export interface UseProgressiveMessagesOptions {
  /**
   * Array of messages to cycle through
   */
  messages: string[];
  /**
   * Array of timeouts in milliseconds for when to switch to each message.
   * The first timeout corresponds to switching from messages[0] to messages[1],
   * the second timeout corresponds to switching from messages[1] to messages[2], etc.
   * If not provided, defaults to [5000, 9000, 13000, 18000] (5s, 9s, 13s, 18s intervals)
   */
  timeouts?: number[];
  /**
   * Whether to automatically start the progression on mount.
   * Defaults to true.
   */
  autoStart?: boolean;
}

/**
 * Hook for managing progressive message switching with configurable timeouts.
 * Useful for loading states where you want to show different messages as time progresses.
 *
 * @example
 * ```tsx
 * const messages = ["Loading...", "Processing...", "Almost done..."];
 * const timeouts = [3000, 6000]; // Switch to second message after 3s, third after 6s
 * const { currentMessage, currentIndex } = useProgressiveMessages({ messages, timeouts });
 * ```
 */
export function useProgressiveMessages({
  messages,
  timeouts = [5000, 9000, 13000, 18000],
  autoStart = true,
}: UseProgressiveMessagesOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!autoStart || messages.length <= 1) {
      return;
    }

    // Reset to first message whenever the component mounts
    setCurrentIndex(0);

    const timeoutIds: number[] = [];

    // Schedule timeouts for each message transition
    // We need (messages.length - 1) timeouts to transition from first to last
    const numTransitions = Math.min(messages.length - 1, timeouts.length);

    for (let i = 0; i < numTransitions; i++) {
      const targetIndex = i + 1;
      const delay = timeouts[i];

      if (delay > 0 && messages[targetIndex]) {
        timeoutIds.push(
          window.setTimeout(() => {
            setCurrentIndex((prev) => {
              // Only update if we haven't already moved past this index
              // (in case component unmounts/remounts or messages change)
              return prev < targetIndex ? targetIndex : prev;
            });
          }, delay)
        );
      }
    }

    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
    // We intentionally don't include `messages` and `timeouts` in deps to avoid
    // restarting timers on every re-render. They should be stable for the lifetime of the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const currentMessage = messages[currentIndex] || messages[0] || "";

  return {
    currentMessage,
    currentIndex,
    setCurrentIndex,
  };
}

