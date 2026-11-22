import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { EngineEvents, EngineHandle } from "./YouTubeEngine";
import { setAudioElement } from "@/lib/playback";

interface Props extends EngineEvents {
  src: string;
  playing: boolean;
  /** 0..1 */
  volume?: number;
  /** Playback speed, 1 = normal */
  rate?: number;
  ref?: Ref<EngineHandle>;
}

/** Plays an uploaded audio file with a (hidden) <audio> element */
const AudioEngine = ({
  src,
  playing,
  volume = 1,
  rate = 1,
  ref,
  onTime,
  onDuration,
  onEnded,
  onError,
  onPlayingChange,
}: Props) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Lets remote control check that a song really started
  useEffect(() => {
    setAudioElement(audioRef.current);
    return () => setAudioElement(null);
  }, []);

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
    // The same <audio> element plays every song (a new source resets it to
    // paused), which also keeps it allowed to play in a background tab.
    // Only react to the requested state and source, not to callback identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

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
      // Loading a source resets the speed
      onLoadedMetadata={(e) => {
        e.currentTarget.playbackRate = rate;
      }}
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
