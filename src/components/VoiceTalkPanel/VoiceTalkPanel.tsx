import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Mic, Sparkles } from "lucide-react";
import hark from "hark";
import "./VoiceTalkPanel.css";
import { createApiClient, type ApiClient } from "../../services/api/apiClient";
import { createVoiceTalkService } from "../../services/chat/voice-talk";
import type { ChatMessage } from "../../services/chat/types";

type VoiceMode = "idle" | "listening" | "processing" | "responding";

interface VoiceTalkPanelProps {
  apiBase: string;
  widgetKey: string;
  sendMessage: (text: string, imageUrl?: string) => Promise<void>;
  messages: ChatMessage[];
}

export interface VoiceTalkPanelRef {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  isRecording: boolean;
  mode: VoiceMode;
}

const VoiceTalkPanel = forwardRef<VoiceTalkPanelRef, VoiceTalkPanelProps>(
  ({ apiBase, widgetKey, sendMessage, messages }, ref) => {
    const [mode, setMode] = useState<VoiceMode>("idle");
    const [levels, setLevels] = useState([0.25, 0.5, 0.35]);
    const [isSupported, setIsSupported] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const isRecordingRef = useRef(false);

    // Sync ref with state
    useEffect(() => {
      isRecordingRef.current = isRecording;
    }, [isRecording]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const levelTimerRef = useRef<number | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const harkRef = useRef<any>(null);
    const levelLogCounterRef = useRef<number>(0); // For periodic level logging
    const apiClientRef = useRef<ApiClient | null>(null);
    const voiceTalkServiceRef = useRef<ReturnType<
      typeof createVoiceTalkService
    > | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const processingCountRef = useRef<number>(0);
    const lastReadMessageIdRef = useRef<string | null>(null);
    const isVoiceActiveRef = useRef<boolean>(false);


    const status = useMemo(
      () =>
      ({
        idle: "Tap to describe your space",
        listening: "Listening…",
        processing: "Processing…",
        responding: "Assistant is speaking…",
      }[mode]),
      [mode]
    );

    useEffect(() => {
      if (!apiClientRef.current) {
        apiClientRef.current = createApiClient(apiBase, widgetKey);
        voiceTalkServiceRef.current = createVoiceTalkService(
          apiClientRef.current
        );
      }
    }, [apiBase, widgetKey]);

    useEffect(() => {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia ||
        !window.MediaRecorder
      ) {
        setIsSupported(false);
      }
    }, []);

    const startLevelAnimation = () => {
      if (levelTimerRef.current) return;

      levelLogCounterRef.current = 0; // Reset log counter

      if (!audioContextRef.current && streamRef.current) {
        try {
          const AudioContextClass =
            window.AudioContext ||
            (
              window as typeof window & {
                webkitAudioContext?: typeof AudioContext;
              }
            ).webkitAudioContext;
          if (!AudioContextClass) {
            throw new Error("AudioContext not supported");
          }

          const audioContext = new AudioContextClass();
          const analyser = audioContext.createAnalyser();
          const source = audioContext.createMediaStreamSource(
            streamRef.current
          );

          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.3; // Lower for faster response to silence
          source.connect(analyser);

          audioContextRef.current = audioContext;
          analyserRef.current = analyser;
          const buffer = new ArrayBuffer(analyser.frequencyBinCount);
          dataArrayRef.current = new Uint8Array(
            buffer
          ) as Uint8Array<ArrayBuffer>;
        } catch (error) {
          console.error("Error initializing audio context:", error);
        }
      }

      levelTimerRef.current = window.setInterval(() => {
        if (analyserRef.current && dataArrayRef.current) {
          const dataArray = dataArrayRef.current;
          analyserRef.current.getByteFrequencyData(dataArray);

          const bufferLength = dataArray.length;
          const chunkSize = Math.floor(bufferLength / 3);

          const bar1 = Array.from(dataArray.slice(0, chunkSize));
          const bar2 = Array.from(dataArray.slice(chunkSize, chunkSize * 2));
          const bar3 = Array.from(dataArray.slice(chunkSize * 2));

          const avg1 = bar1.reduce((a, b) => a + b, 0) / bar1.length / 255;
          const avg2 = bar2.reduce((a, b) => a + b, 0) / bar2.length / 255;
          const avg3 = bar3.reduce((a, b) => a + b, 0) / bar3.length / 255;
          const overallLevel = (avg1 + avg2 + avg3) / 3;
          const silenceThreshold = 0.15; // Adjusted for better silence detection

          // Log level every 2 seconds for debugging
          levelLogCounterRef.current++;
          if (levelLogCounterRef.current % 20 === 0 && isRecording) {
            console.log(
              `[Level] 🎤 Audio: ${overallLevel.toFixed(
                3
              )} | Threshold: ${silenceThreshold} | ${overallLevel < silenceThreshold ? "🔇 QUIET" : "🔊 SPEAKING"
              }`
            );
          }

          // Manual silence detection removed in favor of hark
          setLevels([
            Math.max(0.1, avg1 * 1.5),
            Math.max(0.1, avg2 * 1.5),
            Math.max(0.1, avg3 * 1.5),
          ]);
        } else {
          setLevels([Math.random(), Math.random(), Math.random()]);
        }
      }, 100);
    };

    const stopLevelAnimation = () => {
      if (levelTimerRef.current) {
        window.clearInterval(levelTimerRef.current);
        levelTimerRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      dataArrayRef.current = null;
      levelLogCounterRef.current = 0;

      setLevels([0.25, 0.25, 0.25]);
    };

    const textToSpeech = useCallback(
      async (text: string): Promise<void> => {
        if (!voiceTalkServiceRef.current || !text.trim()) return;

        try {
          const response = await voiceTalkServiceRef.current.textToSpeech(
            text,
            {
              voiceName: "Sulafat",
            }
          );

          if (response.audioContent) {
            const audioData = `data:${response.contentType || "audio/mpeg"
              };base64,${response.audioContent}`;

            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.src = "";
            }

            const audio = new Audio(audioData);
            audioRef.current = audio;

            await new Promise<void>((resolve, reject) => {
              audio.onended = () => {
                // Check current recording state at the time audio ends
                const stillRecording =
                  mediaRecorderRef.current?.state === "recording";
                if (stillRecording) {
                  setMode("listening");
                } else {
                  setMode("idle");
                }
                resolve();
              };
              audio.onerror = reject;
              audio.play().catch(reject);
            });
          }
        } catch (error) {
          console.error("TTS API error:", error);
          const stillRecording =
            mediaRecorderRef.current?.state === "recording";
          if (stillRecording) {
            setMode("listening");
          } else {
            setMode("idle");
          }
        }
      },
      [] // Remove isRecording dependency to prevent infinite loop
    );

    const processCurrentSegment = useCallback(async () => {
      if (audioChunksRef.current.length === 0) {
        return;
      }

      processingCountRef.current++;
      setMode("processing");

      // Process all chunks in the current buffer
      const chunksToProcess = [...audioChunksRef.current];
      audioChunksRef.current = []; // Clear buffer immediately for next segment

      const segmentBlob = new Blob(chunksToProcess, {
        type: "audio/webm;codecs=opus",
      });

      console.log(
        `[STT] Processing segment: ${chunksToProcess.length} chunks, ${segmentBlob.size
        } bytes`
      );

      if (segmentBlob.size > 0) {
        try {
          if (!voiceTalkServiceRef.current) {
            throw new Error("Voice talk service not initialized");
          }

          const transcribedText =
            await voiceTalkServiceRef.current.speechToText(segmentBlob);
          console.log(`[STT] Transcribed: "${transcribedText}"`);

          if (transcribedText.trim()) {
            await sendMessage(transcribedText);
            console.log("[STT] Message sent successfully");
          } else {
            console.warn("[STT] No text transcribed from audio");
          }
        } catch (error) {
          console.error("Error processing speech:", error);
        }
      }

      processingCountRef.current--;

      // Check ref to avoid stale closure issues
      if (isRecordingRef.current) {
        if (processingCountRef.current > 0) {
          setMode("processing");
        } else {
          setMode("listening");
        }
      } else {
        setMode("idle");
      }
    }, [sendMessage]);



    const startRecording = async () => {
      // Cleanup any existing recorder to prevent ghosts
      if (mediaRecorderRef.current) {
        console.warn("[VoiceTalkPanel] Cleaning up previous recorder before starting new one");
        const oldRecorder = mediaRecorderRef.current;
        // Remove event listeners to prevent "restart" logic or data collection
        oldRecorder.onstop = null;
        oldRecorder.ondataavailable = null;

        if (oldRecorder.state !== "inactive") {
          oldRecorder.stop();
        }
        mediaRecorderRef.current = null;
      }

      // Also stop old stream if exists
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      // Stop hark
      if (harkRef.current) {
        harkRef.current.stop();
        harkRef.current = null;
      }

      try {
        console.log("Requesting microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        // Initialize hark for silence detection
        const speechEvents = hark(stream, {
          interval: 100,
          threshold: -50,
          history: 10,
        });

        speechEvents.on("stopped_speaking", () => {
          console.log("[Hark] 🔇 Stopped speaking. Restarting recorder to finalize file...");
          if (
            mediaRecorderRef.current?.state === "recording"
          ) {
            // Stop the recorder. This triggers 'onstop' where we process the file and restart if needed.
            mediaRecorderRef.current.stop();
          }
        });

        harkRef.current = speechEvents;

        streamRef.current = stream;
        audioChunksRef.current = [];
        processingCountRef.current = 0;

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          console.log("[VoiceTalkPanel] MediaRecorder stopped");

          // Should we process what we have? Yes.
          if (audioChunksRef.current.length > 0) {
            void processCurrentSegment();
          }

          // If we are still "recording" (in the React state sense), this was an auto-restart.
          // So we should start recording again immediately.
          if (isRecordingRef.current) {
            console.log("[VoiceTalkPanel] Auto-restarting recorder...");
            // Small delay to ensure clean state? Usually fine to start immediately.
            mediaRecorder.start(100);
          } else {
            // This was a manual stop. Clean up everything.
            stopLevelAnimation();
            stream.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        };

        if (!MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          console.warn("WebM Opus not supported, trying default");
        }

        mediaRecorder.start(100);
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        isRecordingRef.current = true; // Force ref update immediately
        isVoiceActiveRef.current = true;

        await readFirstBotMessage();

        setTimeout(() => {
          startLevelAnimation();
        }, 100);

        if (mode !== "responding") {
          setMode("listening");
        }
      } catch (error) {
        console.error("Error starting recording:", error);
        setIsSupported(false);
        setMode("idle");
      }
    };

    const stopRecording = () => {
      console.log("[VoiceTalkPanel] Stopping recording...");

      // Update state first so onstop knows we are done
      setIsRecording(false);
      isRecordingRef.current = false; // Force ref update immediately
      isVoiceActiveRef.current = false;

      if (harkRef.current) {
        harkRef.current.stop();
        harkRef.current = null;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };

    const readFirstBotMessage = useCallback(async () => {
      if (messages.length === 0) {
        setMode("listening");
        return;
      }

      let firstBotMessage: ChatMessage | null = null;

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (message.from === "bot") {
          firstBotMessage = message;
          break;
        }
      }

      if (firstBotMessage) {
        lastReadMessageIdRef.current = firstBotMessage.id;
        // First try information and question
        let textToSpeak = [
          firstBotMessage.information,
          firstBotMessage.question,
        ]
          .filter(Boolean)
          .join(". ");

        // If information and question are both null/empty, use text as fallback
        if (!textToSpeak.trim() && firstBotMessage.text) {
          textToSpeak = firstBotMessage.text;
        }

        if (textToSpeak.trim()) {
          setMode("responding");
          try {
            await textToSpeech(textToSpeak);
          } catch (error) {
            console.error("Error in text-to-speech:", error);
            const stillRecording =
              mediaRecorderRef.current?.state === "recording";
            if (stillRecording) {
              setMode("listening");
            } else {
              setMode("idle");
            }
          }
        } else {
          const stillRecording =
            mediaRecorderRef.current?.state === "recording";
          if (stillRecording) {
            setMode("listening");
          }
        }
      } else {
        const stillRecording = mediaRecorderRef.current?.state === "recording";
        if (stillRecording) {
          setMode("listening");
        }
      }
    }, [messages, textToSpeech]);

    // Auto-TTS for new admin messages
    useEffect(() => {
      if (messages.length === 0) return;

      const lastMessage = messages[messages.length - 1];

      // Check if it's an admin message and we haven't read it yet
      // AND ensure voice session is actively running (prevent auto-read when panel is just open but idle)
      if (
        isVoiceActiveRef.current &&
        lastMessage.isAdmin &&
        lastMessage.id !== lastReadMessageIdRef.current
      ) {
        lastReadMessageIdRef.current = lastMessage.id;

        // Construct text to speak (Information + Question/Text)
        let textToSpeak = [
          lastMessage.information,
          lastMessage.question || lastMessage.text
        ]
          .filter(Boolean)
          .join(". ");

        if (textToSpeak.trim()) {
          console.log("[Auto-TTS] Reading new admin message:", textToSpeak);
          setMode("responding");

          // We need to ensure we don't interrupt the user if they are speaking, 
          // but usually the server response comes after user finishes.
          // Safest to just play it.
          textToSpeech(textToSpeak).catch(err => {
            console.error("[Auto-TTS] Error:", err);
            setMode("idle");
          });
        }
      }
    }, [messages, textToSpeech]);

    // Cleanup only on component unmount (not on every isRecording change)
    useEffect(() => {
      return () => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        stopLevelAnimation();
        if (harkRef.current) {
          harkRef.current.stop();
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
      };
    }, []); // Empty dependency array = run cleanup only on unmount

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        startRecording,
        stopRecording,
        isRecording,
        mode,
      }),
      [isRecording, mode, startRecording, stopRecording]
    );

    const buttonLabel = !isSupported
      ? "Microphone not supported"
      : mode === "idle"
        ? "Press to start voice chat"
        : mode === "listening"
          ? "Listening…"
          : mode === "processing"
            ? "Processing…"
            : "Assistant is speaking…";

    const showBars = mode === "listening";

    return (
      <div className={`fcw-voice-panel ${mode === "idle" ? "fcw-voice-panel-idle" : ""}`}>
        <header className="fcw-voice-header">
          <Sparkles size={18} />
          <div>
            <p>Voice Companion</p>
            <span>{status}</span>
          </div>
        </header>

        <div className="fcw-voice-center">
          <div
            className={`fcw-voice-mic ${mode}`}
            style={{ cursor: "default", pointerEvents: "none" }}
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
          </div>
          <p>{buttonLabel}.</p>
        </div>
      </div>
    );
  }
);

VoiceTalkPanel.displayName = "VoiceTalkPanel";

export default VoiceTalkPanel;
