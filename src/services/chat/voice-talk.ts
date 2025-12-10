import type { ApiClient } from "../api/apiClient";

export interface SpeechToTextRequest {
  audioContent: string;
  encoding: string;
  sampleRateHertz: number;
  languageCode: string;
}

export interface SpeechToTextResponse {
  transcript: string;
  confidence?: number;
}

export interface TextToSpeechRequest {
  text: string;
  languageCode: string;
  voiceName: string;
  ssmlGender: string;
  audioEncoding: string;
  speakingRate: number;
  pitch: number;
}

export interface TextToSpeechResponse {
  audioContent: string;
  contentType: string;
}

export const audioBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64 = base64String.split(",")[1] || base64String;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const createVoiceTalkService = (apiClient: ApiClient) => {
  const speechToText = async (
    audioBlob: Blob,
    options?: Partial<SpeechToTextRequest>
  ): Promise<string> => {
    try {
      const audioBase64 = await audioBlobToBase64(audioBlob);
      const request: SpeechToTextRequest = {
        audioContent: audioBase64,
        encoding: options?.encoding || "LINEAR16",
        sampleRateHertz: options?.sampleRateHertz || 16000,
        languageCode: options?.languageCode || "en-US",
      };
      const response = await apiClient.post<SpeechToTextResponse>(
        "/widget-users/speech-to-text",
        request
      );

      return response.transcript || "";
    } catch (error) {
      console.error("STT API error:", error);
      throw error;
    }
  };

  const textToSpeech = async (
    text: string,
    options?: Partial<TextToSpeechRequest>
  ): Promise<TextToSpeechResponse> => {
    if (!text.trim()) {
      throw new Error("Text cannot be empty");
    }
    try {
      const request: TextToSpeechRequest = {
        text: text,
        languageCode: options?.languageCode || "en-US",
        voiceName: options?.voiceName || "Sulafat",
        ssmlGender: options?.ssmlGender || "FEMALE",
        audioEncoding: options?.audioEncoding || "MP3",
        speakingRate: options?.speakingRate ?? 1,
        pitch: options?.pitch ?? 0,
      };

      const response = await apiClient.post<TextToSpeechResponse>(
        "/widget-users/text-to-speech",
        request
      );

      return response;
    } catch (error) {
      console.error("TTS API error:", error);
      throw error;
    }
  };

  return {
    speechToText,
    textToSpeech,
    audioBlobToBase64,
  };
};

export type VoiceTalkService = ReturnType<typeof createVoiceTalkService>;
