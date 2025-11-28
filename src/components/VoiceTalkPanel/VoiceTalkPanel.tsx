import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import "./VoiceTalkPanel.css";

type VoiceMode = "idle" | "listening" | "responding";

const VoiceTalkPanel: React.FC = () => {
  const [mode, setMode] = useState<VoiceMode>("idle");
  const [levels, setLevels] = useState([0.25, 0.5, 0.35]);
  const respondTimeoutRef = useRef<number | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const levelTimerRef = useRef<number | null>(null);

  const status = useMemo(
    () =>
      ({
        idle: "Tap to describe your space",
        listening: "Listening…",
        responding: "Assistant is speaking…",
      }[mode]),
    [mode]
  );

  const startLevelAnimation = () => {
    if (levelTimerRef.current) return;
    levelTimerRef.current = window.setInterval(() => {
      setLevels([Math.random(), Math.random(), Math.random()]);
    }, 120);
  };

  const stopLevelAnimation = () => {
    if (levelTimerRef.current) {
      window.clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    setLevels([0.25, 0.25, 0.25]);
  };

  useEffect(() => {
    const SpeechRecognitionClass =
      window.SpeechRecognition ||
      (window as typeof window & {
        webkitSpeechRecognition?: typeof SpeechRecognition;
      }).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setMode("listening");
    recognition.onspeechstart = () => startLevelAnimation();
    recognition.onspeechend = () => stopLevelAnimation();
    recognition.onend = () => {
      stopLevelAnimation();
      setMode("responding");
      if (respondTimeoutRef.current) {
        window.clearTimeout(respondTimeoutRef.current);
      }
      respondTimeoutRef.current = window.setTimeout(() => setMode("idle"), 3500);
    };
    recognition.onerror = () => {
      stopLevelAnimation();
      setMode("idle");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      stopLevelAnimation();
      if (respondTimeoutRef.current) {
        window.clearTimeout(respondTimeoutRef.current);
      }
    };
  }, []);

  const handlePress = () => {
    if (!isSupported) return;

    if (mode === "idle") {
      recognitionRef.current?.start();
    } else {
      recognitionRef.current?.stop();
    }
  };

  const buttonLabel =
    !isSupported
      ? "Microphone not supported"
      : mode === "idle"
      ? "Press to start voice chat"
      : mode === "listening"
      ? "Listening…"
      : "Generating reply…";

  const showBars = mode !== "idle";

  return (
    <div className="fcw-voice-panel">
      <header className="fcw-voice-header">
        <Sparkles size={18} />
        <div>
          <p>Voice Companion</p>
          <span>{status}</span>
        </div>
      </header>

      <div className="fcw-voice-center">
        <button
          className={`fcw-voice-mic ${mode}`}
          onClick={handlePress}
          disabled={!isSupported}
          aria-live="polite"
        >
          <Mic size={38} />
          {showBars && (
            <span className="fcw-voice-bars" aria-hidden="true">
              {levels.map((lvl, idx) => (
                <i key={idx} style={{ height: `${14 + lvl * 26}px` }} />
              ))}
            </span>
          )}
        </button>
        <p>{buttonLabel}</p>
      </div>
    </div>
  );
};

export default VoiceTalkPanel;

