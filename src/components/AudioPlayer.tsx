interface AudioPlayerProps { src: string; }
export function AudioPlayer({ src }: AudioPlayerProps) { return <audio className="audio-player" controls preload="metadata" src={src} />; }
