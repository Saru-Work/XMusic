import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { EngineEvents, EngineHandle } from "./YouTubeEngine";

interface Props extends EngineEvents {
  src: string;
  playing: boolean;
  /** 0..1 */
  volume?: number;
  ref?: Ref<EngineHandle>;
}

/** Plays an uploaded audio file with a (hidden) <audio> element */
const AudioEngine = ({
  src,
  playing,
  volume = 1,
  ref,
  onTime,
  onDuration,
  onEnded,
  onError,
  onPlayingChange,
}: Props) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.play().catch((err) => {
        // AbortError just means another play()/pause() superseded this one
        if (err?.name !== "AbortError") onPlayingChange?.(false);
      });
    } else {
      audio.pause();
    }
    // Only react to the requested state, not to callback identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useImperativeHandle(
    ref,
    () => ({
      seek: (seconds) => {
        if (audioRef.current) audioRef.current.currentTime = seconds;
      },
      restart: () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = 0;
        audio.play().catch(() => {});
      },
    }),
    [],
  );

  return (
    <audio
      ref={audioRef}
      src={src}
      preload="auto"
      onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)}
      onDurationChange={(e) => {
        if (Number.isFinite(e.currentTarget.duration))
          onDuration?.(e.currentTarget.duration);
      }}
      onEnded={onEnded}
      onError={() => onError?.("This track couldn't be played.")}
    />
  );
};

export default AudioEngine;
