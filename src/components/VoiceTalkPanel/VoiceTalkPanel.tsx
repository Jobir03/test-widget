import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Mic, Sparkles, Volume2, VolumeX } from "lucide-react";
import hark from "hark";
import "./VoiceTalkPanel.css";
import { createApiClient, type ApiClient } from "../../services/api/apiClient";
import { createVoiceTalkService } from "../../services/chat/voice-talk";
import type { ChatMessage } from "../../services/chat/types";

type VoiceMode =
  | "idle"
  | "listening"
  | "processing"
  | "responding"
  | "initializing";

interface VoiceTalkPanelProps {
  apiBase: string;
  widgetKey: string;
  sendMessage: (text: string, imageUrl?: string) => Promise<void>;
  messages: ChatMessage[];
  onStateChange?: (isRecording: boolean) => void;
  onTTSComplete?: (messageId: string) => void;
  isChatOpen?: boolean;
}

export interface VoiceTalkPanelRef {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  isRecording: boolean;
  mode: VoiceMode;
  toggleMute: () => void;
  isAgentMuted: boolean;
}

// Module-level refs to persist across component mounts/unmounts
const lastReadMessageIdRef = { current: null as string | null };
const hasReadFirstMessageRef = { current: false };

// Helper to find the latest bot message (most recent timestamp)
const findLatestBotMessage = (messages: ChatMessage[]) => {
  if (messages.length === 0) return null;
  // Sort by timestamp descending (newest first)
  const sorted = [...messages].sort((a, b) => {
    const tA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
    const tB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
    return tB - tA;
  });

  return sorted.find(msg => msg.from === "bot" || msg.isAdmin === true) || null;
};

const VoiceTalkPanel = forwardRef<VoiceTalkPanelRef, VoiceTalkPanelProps>(
  ({ apiBase, widgetKey, sendMessage, messages, onStateChange, onTTSComplete, isChatOpen = false }, ref) => {
    const [mode, setMode] = useState<VoiceMode>("initializing");
    const [levels, setLevels] = useState([0.25, 0.5, 0.35]);
    const [isSupported, setIsSupported] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [isAgentMuted, setIsAgentMuted] = useState(false);
    const [isMicActive, setIsMicActive] = useState(false); // To signal user intent

    // Refs for state access inside callbacks/effects without deps
    const isRecordingRef = useRef(false);
    const isAgentMutedRef = useRef(false);

    // Sync ref with state
    useEffect(() => {
      isRecordingRef.current = isRecording;
      onStateChange?.(isRecording);
    }, [isRecording, onStateChange]);

    useEffect(() => {
      isAgentMutedRef.current = isAgentMuted;
      // Stop current audio if muted
      if (isAgentMuted && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        if (mode === "responding") {
          // If we were responding and got muted, go back to listening/idle
          if (isRecordingRef.current) {
            setMode("listening");
          } else {
            setMode("idle");
          }
        }
      }
    }, [isAgentMuted, mode]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const levelTimerRef = useRef<number | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const harkRef = useRef<any>(null);

    const levelLogCounterRef = useRef<number>(0);

    const apiClientRef = useRef<ApiClient | null>(null);
    const voiceTalkServiceRef = useRef<ReturnType<
      typeof createVoiceTalkService
    > | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const audioOutputContextRef = useRef<AudioContext | null>(null);
    const audioOutputAnalyserRef = useRef<AnalyserNode | null>(null);
    const audioOutputDataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(
      null
    );
    const processingCountRef = useRef<number>(0);
    const hasInitializedRef = useRef<boolean>(false);

    const status = useMemo(
      () =>
      ({
        initializing: "Connecting...",
        idle: "Ready",
        listening: "Listening…",
        processing: "Processing…",
        responding: "Speaking…",
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
      levelLogCounterRef.current = 0;

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
          analyser.smoothingTimeConstant = 0.3;
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
        // Check if we're analyzing audio output (agent speaking)
        if (audioOutputAnalyserRef.current && audioOutputDataArrayRef.current) {
          const dataArray = audioOutputDataArrayRef.current;
          audioOutputAnalyserRef.current.getByteFrequencyData(dataArray);

          const bufferLength = dataArray.length;
          const chunkSize = Math.floor(bufferLength / 3);

          const bar1 = Array.from(dataArray.slice(0, chunkSize));
          const bar2 = Array.from(dataArray.slice(chunkSize, chunkSize * 2));
          const bar3 = Array.from(dataArray.slice(chunkSize * 2));

          const avg1 = bar1.reduce((a, b) => a + b, 0) / bar1.length / 255;
          const avg2 = bar2.reduce((a, b) => a + b, 0) / bar2.length / 255;
          const avg3 = bar3.reduce((a, b) => a + b, 0) / bar3.length / 255;

          levelLogCounterRef.current++;

          setLevels([
            Math.max(0.1, avg1 * 1.8),
            Math.max(0.1, avg2 * 1.8),
            Math.max(0.1, avg3 * 1.8),
          ]);
        } else if (analyserRef.current && dataArrayRef.current) {
          // Analyzing microphone input (user speaking)
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

          levelLogCounterRef.current++;

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

      if (audioOutputContextRef.current) {
        audioOutputContextRef.current.close().catch(console.error);
        audioOutputContextRef.current = null;
      }
      audioOutputAnalyserRef.current = null;
      audioOutputDataArrayRef.current = null;

      levelLogCounterRef.current = 0;

      setLevels([0.25, 0.25, 0.25]);
    };

    const textToSpeech = useCallback(async (text: string, messageId?: string): Promise<void> => {
      if (
        !voiceTalkServiceRef.current ||
        !text.trim() ||
        isAgentMutedRef.current
      )
        return;

      try {
        setMode("responding");

        const response = await voiceTalkServiceRef.current.textToSpeech(text, {
          voiceName: "Sulafat",
        });

        if (isAgentMutedRef.current) {
          setMode(isRecordingRef.current ? "listening" : "idle");
          // Still reveal message even if muted
          if (messageId && onTTSComplete) {
            onTTSComplete(messageId);
          }
          return;
        }

        if (response.audioContent) {
          const audioData = `data:${response.contentType || "audio/mpeg"
            };base64,${response.audioContent}`;

          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
          }

          const audio = new Audio(audioData);
          audioRef.current = audio;

          // Setup audio output analyzer for visualization
          try {
            const AudioContextClass =
              window.AudioContext ||
              (
                window as typeof window & {
                  webkitAudioContext?: typeof AudioContext;
                }
              ).webkitAudioContext;

            if (AudioContextClass) {
              const audioOutputContext = new AudioContextClass();
              const audioOutputAnalyser = audioOutputContext.createAnalyser();
              const audioSource =
                audioOutputContext.createMediaElementSource(audio);

              audioOutputAnalyser.fftSize = 256;
              audioOutputAnalyser.smoothingTimeConstant = 0.8;
              audioSource.connect(audioOutputAnalyser);
              audioOutputAnalyser.connect(audioOutputContext.destination);

              audioOutputContextRef.current = audioOutputContext;
              audioOutputAnalyserRef.current = audioOutputAnalyser;
              const buffer = new ArrayBuffer(
                audioOutputAnalyser.frequencyBinCount
              );
              audioOutputDataArrayRef.current = new Uint8Array(
                buffer
              ) as Uint8Array<ArrayBuffer>;

              // Start animation for audio output
              startLevelAnimation();
            }
          } catch (error) {
            console.error("Error setting up audio output analyzer:", error);
          }

          // Notify that TTS is ready and message can be shown
          // This happens when audio starts playing, not when it ends
          if (messageId && onTTSComplete) {
            onTTSComplete(messageId);
          }

          await new Promise<void>((resolve, reject) => {
            audio.onended = () => {
              // Cleanup audio output analyzer
              if (audioOutputContextRef.current) {
                audioOutputContextRef.current.close().catch(console.error);
                audioOutputContextRef.current = null;
              }
              audioOutputAnalyserRef.current = null;
              audioOutputDataArrayRef.current = null;

              const stillRecording =
                mediaRecorderRef.current?.state === "recording";
              if (stillRecording) {
                setMode("listening");
              } else {
                setMode("idle");
                stopLevelAnimation();
              }
              resolve();
            };
            audio.onerror = reject;

            // Handle autoplay restrictions
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                console.error("Auto-play prevented:", error);
                // Cleanup on error
                if (audioOutputContextRef.current) {
                  audioOutputContextRef.current.close().catch(console.error);
                  audioOutputContextRef.current = null;
                }
                audioOutputAnalyserRef.current = null;
                audioOutputDataArrayRef.current = null;

                // If blocked, we just revert state
                const stillRecording =
                  mediaRecorderRef.current?.state === "recording";
                if (stillRecording) {
                  setMode("listening");
                } else {
                  setMode("idle");
                  stopLevelAnimation();
                }
                // Still reveal message even if autoplay fails
                if (messageId && onTTSComplete) {
                  onTTSComplete(messageId);
                }
                reject(error);
              });
            }
          });
        }
      } catch (error) {
        console.error("TTS API error:", error);
        const stillRecording = mediaRecorderRef.current?.state === "recording";
        if (stillRecording) {
          setMode("listening");
        } else {
          setMode("idle");
        }
        // Even on error, reveal the message
        if (messageId && onTTSComplete) {
          onTTSComplete(messageId);
        }
      }
    }, [onTTSComplete]);

    const processCurrentSegment = useCallback(async () => {
      if (audioChunksRef.current.length === 0) {
        return;
      }

      processingCountRef.current++;
      setMode("processing");

      const chunksToProcess = [...audioChunksRef.current];
      audioChunksRef.current = [];

      const segmentBlob = new Blob(chunksToProcess, {
        type: "audio/webm;codecs=opus",
      });

      console.log(
        `[STT] Processing segment: ${chunksToProcess.length} chunks, ${segmentBlob.size} bytes`
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

    const startRecording = useCallback(async () => {
      // Cleanup any existing recorder to prevent ghosts
      if (mediaRecorderRef.current) {
        console.warn(
          "[VoiceTalkPanel] Cleaning up previous recorder before starting new one"
        );
        const oldRecorder = mediaRecorderRef.current;
        oldRecorder.onstop = null;
        oldRecorder.ondataavailable = null;

        if (oldRecorder.state !== "inactive") {
          oldRecorder.stop();
        }
        mediaRecorderRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

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

        const speechEvents = hark(stream, {
          interval: 100,
          threshold: -50,
          history: 10,
        });

        speechEvents.on("speaking", () => {
          console.log("[Hark] 🗣️ User started speaking");
          // If agent is speaking, stop the agent audio
          if (audioRef.current && !audioRef.current.paused) {
            console.log(
              "[Hark] 🛑 Stopping agent speech because user started speaking"
            );
            audioRef.current.pause();
            audioRef.current.src = "";

            // Cleanup audio output analyzer
            if (audioOutputContextRef.current) {
              audioOutputContextRef.current.close().catch(console.error);
              audioOutputContextRef.current = null;
            }
            audioOutputAnalyserRef.current = null;
            audioOutputDataArrayRef.current = null;

            // Switch to listening mode
            setMode("listening");
          }
        });

        speechEvents.on("stopped_speaking", () => {
          console.log(
            "[Hark] 🔇 Stopped speaking. Restarting recorder to finalize file..."
          );
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
          }
        });

        harkRef.current = speechEvents;

        streamRef.current = stream;
        audioChunksRef.current = [];
        processingCountRef.current = 0;

        const getSupportedMimeType = () => {
          const types = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4",
            "audio/mpeg",
            "audio/wav",
            "audio/aac",
          ];
          for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
              return type;
            }
          }
          return undefined; // Let browser interpret default
        };

        const mimeType = getSupportedMimeType();
        console.log("[VoiceTalkPanel] Using MIME type:", mimeType);

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType,
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          console.log("[VoiceTalkPanel] MediaRecorder stopped");

          if (audioChunksRef.current.length > 0) {
            void processCurrentSegment();
          }

          if (isRecordingRef.current) {
            console.log("[VoiceTalkPanel] Auto-restarting recorder...");
            mediaRecorder.start(100);
          } else {
            stopLevelAnimation();
            stream.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        };



        mediaRecorder.start(100);
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        isRecordingRef.current = true;
        setIsMicActive(true);

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
    }, [mode, processCurrentSegment]);

    const stopRecording = useCallback(() => {
      console.log("[VoiceTalkPanel] Stopping recording...");

      setIsRecording(false);
      isRecordingRef.current = false;
      setIsMicActive(false);

      if (harkRef.current) {
        harkRef.current.stop();
        harkRef.current = null;
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    }, []);

    const readLastRelevantMessage = useCallback(async () => {
      const lastBotMessage = findLatestBotMessage(messages);

      if (!lastBotMessage) return;

      const isFirstMessage = !hasReadFirstMessageRef.current;

      if (!isFirstMessage && lastBotMessage.id === lastReadMessageIdRef.current)
        return;
      if (isAgentMutedRef.current) {
        lastReadMessageIdRef.current = lastBotMessage.id;
        if (isFirstMessage) {
          hasReadFirstMessageRef.current = true;
        }
        // If muted, still reveal message
        if (lastBotMessage.waitingForTTS && onTTSComplete) {
          onTTSComplete(lastBotMessage.id);
        }
        return;
      }

      lastReadMessageIdRef.current = lastBotMessage.id;
      if (isFirstMessage) {
        hasReadFirstMessageRef.current = true;
      }

      // Logic: Information + Question. If both are empty, fallback to Text.
      const structuredSpeach = [lastBotMessage.information, lastBotMessage.question]
        .filter(Boolean)
        .join(". ");

      let textToSpeak = structuredSpeach;

      if (!textToSpeak.trim()) {
        textToSpeak = lastBotMessage.text || "";
      }

      if (textToSpeak.trim()) {
        await textToSpeech(textToSpeak, lastBotMessage.id);
      } else {
        // If no text to speak, reveal message immediately
        if (lastBotMessage.waitingForTTS && onTTSComplete) {
          onTTSComplete(lastBotMessage.id);
        }
      }
    }, [messages, textToSpeech, onTTSComplete]);

    useEffect(() => {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        setMode("idle");
      }
    }, []);
    // Track previous chat open state to detect when chat opens
    const prevChatOpenRef = useRef(isChatOpen);
    const chatJustOpenedRef = useRef(false);
    
    // Track when chat opens
    useEffect(() => {
      const wasClosed = !prevChatOpenRef.current;
      const isNowOpen = isChatOpen;
      
      if (wasClosed && isNowOpen) {
        chatJustOpenedRef.current = true;
      } else {
        chatJustOpenedRef.current = false;
      }
      
      prevChatOpenRef.current = isChatOpen;
    }, [isChatOpen]);
    
    // Read messages when chat is open
    useEffect(() => {
      // Only read messages if chat is open
      if (!isChatOpen) return;

      const lastBotMessage = findLatestBotMessage(messages);
      if (!lastBotMessage) return;

      // Only read if it's a new message (different from last read)
      if (lastBotMessage.id === lastReadMessageIdRef.current) return;

      // If chat just opened and this is the first message to read, add a delay
      if (chatJustOpenedRef.current && !hasReadFirstMessageRef.current) {
        chatJustOpenedRef.current = false; // Reset flag
        const timeoutId = setTimeout(() => {
          void readLastRelevantMessage();
        }, 500);
        return () => clearTimeout(timeoutId);
      } else {
        // For subsequent messages or if chat was already open, read immediately
        void readLastRelevantMessage();
      }
    }, [isChatOpen, messages, readLastRelevantMessage]);

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
    }, []);

    const toggleMute = () => {
      setIsAgentMuted((prev) => !prev);
    };

    useImperativeHandle(
      ref,
      () => ({
        startRecording,
        stopRecording,
        isRecording,
        mode,
        toggleMute,
        isAgentMuted,
      }),
      [isRecording, mode, startRecording, stopRecording, isAgentMuted]
    );

    const buttonLabel = !isSupported
      ? "Microphone not supported"
      : mode === "listening"
        ? "Listening…"
        : mode === "processing"
          ? "Processing…"
          : mode === "responding"
            ? "Assistant is speaking…"
            : !isMicActive
              ? "Voice assistant"
              : "Ready";

    const showBars = mode === "listening" || mode === "responding";

    return (
      <div
        className={`fcw-voice-panel ${mode === "idle" ? "fcw-voice-panel-idle" : ""
          }`}
      >
        <header className="fcw-voice-header">
          <div className="fcw-voice-header-left">
            <Sparkles size={18} />
            <div>
              <p>Voice Companion</p>
              <span>{status}</span>
            </div>
          </div>
          <button
            className="fcw-voice-mute-btn"
            onClick={toggleMute}
            title={isAgentMuted ? "Unmute Agent" : "Mute Agent"}
          >
            {isAgentMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </header>

        <div className="fcw-voice-center">
          {/* The Mic is now just an indicator since it's always on, but we keep the visual */}
          <div
            className={`fcw-voice-mic ${mode}`}
            style={{
              cursor: "default",
              pointerEvents: "none",
              opacity: isAgentMuted ? 0.5 : 1,
            }}
            aria-live="polite"
          >
            <Mic size={38} />
            {showBars && (
              <span
                className={`fcw-voice-bars ${mode === "responding" ? "responding" : ""
                  }`}
                aria-hidden="true"
              >
                {levels.map((lvl, idx) => (
                  <i key={idx} style={{ height: `${14 + lvl * 26}px` }} />
                ))}
              </span>
            )}
          </div>
          <p>{isAgentMuted ? "Agent is muted" : buttonLabel}</p>
        </div>
      </div>
    );
  }
);

VoiceTalkPanel.displayName = "VoiceTalkPanel";

export default VoiceTalkPanel;
