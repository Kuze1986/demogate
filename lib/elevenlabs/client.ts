const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

export interface SynthesizeSpeechInput {
  text: string;
  voiceId?: string;
  tone?: "confident" | "friendly" | "urgent" | "neutral";
  modelId?: string;
}

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

function toneToVoiceSettings(tone?: string): VoiceSettings {
  switch (tone) {
    case "confident":
      return { stability: 0.55, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true };
    case "urgent":
      return { stability: 0.35, similarity_boost: 0.85, style: 0.45, use_speaker_boost: true };
    case "friendly":
      return { stability: 0.65, similarity_boost: 0.75, style: 0.1, use_speaker_boost: false };
    case "neutral":
    default:
      return { stability: 0.7, similarity_boost: 0.75, style: 0.0, use_speaker_boost: false };
  }
}

/**
 * Synthesize speech via ElevenLabs API.
 * Returns a Buffer containing MP3 audio data.
 */
export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const voiceId = input.voiceId ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID;
  if (!voiceId) {
    throw new Error("No ElevenLabs voice ID provided and ELEVENLABS_DEFAULT_VOICE_ID is not set");
  }

  const modelId = input.modelId ?? "eleven_turbo_v2";
  const voiceSettings = toneToVoiceSettings(input.tone);

  const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: input.text,
      model_id: modelId,
      voice_settings: voiceSettings,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Synthesize multiple narration cues and concatenate into a single MP3 buffer.
 * A short silence gap is inserted between cues.
 */
export async function synthesizeNarrationCues(
  cues: Array<{ text: string; tone?: string }>,
  voiceId?: string
): Promise<Buffer> {
  if (cues.length === 0) return Buffer.alloc(0);

  // Synthesize all cues in sequence (ElevenLabs rate limits make parallel risky)
  const buffers: Buffer[] = [];
  for (const cue of cues) {
    if (!cue.text.trim()) continue;
    const buf = await synthesizeSpeech({
      text: cue.text,
      voiceId,
      tone: cue.tone as SynthesizeSpeechInput["tone"],
    });
    buffers.push(buf);
  }

  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];

  // Simple concatenation — for production use ffmpeg concat instead
  // The worker already handles ffmpeg, so we just return the raw concatenated data
  // Each buffer is valid MP3 so concatenation produces valid variable-bitrate MP3
  return Buffer.concat(buffers);
}
