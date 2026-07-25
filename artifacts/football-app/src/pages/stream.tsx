import { useGetMatch, getGetMatchQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Play, ExternalLink, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";
import Hls from "hls.js";

// ── URL normalisation ────────────────────────────────────────────────────────

function toEmbedUrl(raw: string): string {
  // YouTube watch  →  embed
  let m = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0`;

  // YouTube shorts
  m = raw.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1`;

  // Twitch channel  →  embed
  m = raw.match(/twitch\.tv\/([A-Za-z0-9_]+)(?:\?.*)?$/);
  if (m) return `https://player.twitch.tv/?channel=${m[1]}&parent=${location.hostname}&autoplay=true`;

  // Twitch VOD
  m = raw.match(/twitch\.tv\/videos\/(\d+)/);
  if (m) return `https://player.twitch.tv/?video=${m[1]}&parent=${location.hostname}&autoplay=true`;

  // Dailymotion
  const dm = raw.match(/dailymotion\.com\/video\/([A-Za-z0-9]+)/);
  if (dm) return `https://www.dailymotion.com/embed/video/${dm[1]}?autoplay=1`;

  // Facebook: do NOT embed — Facebook blocks iframes on non-whitelisted domains.
  // Handled separately by isFacebook() check below.

  return raw;
}

function isFacebook(url: string) {
  return /facebook\.com|fb\.watch/.test(url);
}

function isVideoFile(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

function isHls(url: string) {
  return /\.m3u8(\?.*)?$/i.test(url);
}

// ── Facebook Live Card ───────────────────────────────────────────────────────

function FacebookLiveCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0f1e] gap-5 px-6 text-center">
      {/* Facebook logo */}
      <div className="w-16 h-16 rounded-2xl bg-[#1877F2] flex items-center justify-center shadow-lg shadow-blue-900/40">
        <svg viewBox="0 0 24 24" fill="white" className="w-9 h-9">
          <path d="M24 12.073C24 5.406 18.627 0 12 0S0 5.406 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.277h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
        </svg>
      </div>

      <div className="space-y-1">
        <p className="text-base font-black text-white">Facebook Live</p>
        <p className="text-xs text-white/50 max-w-xs leading-relaxed">
          Facebook restricts embedded playback to approved domains. Watch the stream directly on Facebook.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-sm rounded-xl px-5 py-3 transition-colors shadow-lg shadow-blue-900/30"
        >
          <ExternalLink className="w-4 h-4" />
          Watch on Facebook
        </a>
        <button
          onClick={copy}
          className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white/80 font-semibold text-xs rounded-xl px-5 py-2.5 transition-colors border border-white/10"
        >
          {copied ? "✓ Link copied!" : "Copy stream link"}
        </button>
      </div>
    </div>
  );
}

// ── HLS Player ──────────────────────────────────────────────────────────────

function HlsPlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    setError(null);

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) setError("Stream failed to load. It may be offline or geo-blocked.");
      });
      return () => hls.destroy();
    }

    // Safari native HLS support
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play().catch(() => {});
      return undefined;
    }

    setError("HLS streams are not supported in this browser.");
    return undefined;
  }, [url]);

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 opacity-70" />
        <p className="text-sm text-white/80">{error}</p>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary underline">
          <ExternalLink className="w-3.5 h-3.5" /> Try in external player
        </a>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className="w-full h-full object-contain bg-black"
      controlsList="nodownload"
    />
  );
}

// ── Iframe Player ────────────────────────────────────────────────────────────

function IframePlayer({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const embedUrl = toEmbedUrl(url);

  if (failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 opacity-70" />
        <p className="text-sm text-white/80">The stream couldn't load in the embedded player.</p>
        <a href={embedUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-semibold bg-primary text-white px-4 py-2 rounded-xl">
          <ExternalLink className="w-4 h-4" /> Open in New Tab
        </a>
      </div>
    );
  }

  return (
    <>
      <iframe
        key={embedUrl}
        src={embedUrl}
        allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture; web-share"
        className="w-full h-full border-0"
        referrerPolicy="no-referrer-when-downgrade"
        onError={() => setFailed(true)}
      />
      {/* Fallback button always visible at bottom */}
      <div className="absolute bottom-2 right-2 z-10">
        <a href={embedUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-semibold bg-black/70 text-white/80 px-2 py-1 rounded-lg backdrop-blur">
          <ExternalLink className="w-3 h-3" /> Open in tab
        </a>
      </div>
    </>
  );
}

// ── Embed Code Player ────────────────────────────────────────────────────────

function EmbedCodePlayer({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  // Execute any <script> tags inside the embed code
  useEffect(() => {
    if (!ref.current) return;
    ref.current.querySelectorAll("script").forEach(oldScript => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach(a => newScript.setAttribute(a.name, a.value));
      newScript.textContent = oldScript.textContent;
      oldScript.replaceWith(newScript);
    });
  }, [code]);

  return (
    <div
      ref={ref}
      className="w-full h-full"
      dangerouslySetInnerHTML={{ __html: code }}
      style={{ lineHeight: 0 }}
    />
  );
}

// ── Main StreamPlayer ────────────────────────────────────────────────────────

function StreamPlayer({
  stream,
}: {
  stream: { url: string; embedCode?: string | null; label: string };
}) {
  if (stream.embedCode?.trim()) {
    return <EmbedCodePlayer code={stream.embedCode} />;
  }

  if (isFacebook(stream.url)) {
    return <FacebookLiveCard url={stream.url} />;
  }

  if (isVideoFile(stream.url)) {
    return (
      <video
        key={stream.url}
        src={stream.url}
        controls
        autoPlay
        playsInline
        className="w-full h-full object-contain bg-black"
        controlsList="nodownload"
      />
    );
  }

  if (isHls(stream.url)) {
    return <HlsPlayer url={stream.url} />;
  }

  // iframe fallback (YouTube, Twitch, Dailymotion, etc.)
  return <IframePlayer url={stream.url} />;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StreamPage() {
  const { id } = useParams();
  const matchId = parseInt(id || "0", 10);

  const { data: match, isLoading } = useGetMatch(matchId, {
    query: { enabled: !!matchId, queryKey: getGetMatchQueryKey(matchId) },
  });

  const [activeStreamId, setActiveStreamId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 pb-6 px-4 pt-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="w-full aspect-video rounded-2xl" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="py-24 text-center px-4">
        <h2 className="text-xl font-bold mb-3">Match not found</h2>
        <Link href="/"><span className="text-primary text-sm font-semibold cursor-pointer">Back to Home</span></Link>
      </div>
    );
  }

  const streams = match.streams ?? [];
  const activeStream = streams.find(s => s.id === activeStreamId) ?? streams[0];

  return (
    <div className="pb-6">
      {/* Back */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Link href={`/match/${match.id}`}>
          <span className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </span>
        </Link>
      </div>

      {/* Player */}
      <div className="bg-black aspect-video relative overflow-hidden">
        {activeStream ? (
          <StreamPlayer stream={activeStream} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Play className="w-6 h-6 opacity-30" />
            </div>
            <p className="text-sm font-medium">No stream available for this match</p>
            <p className="text-xs text-muted-foreground/70">Streams are added by admins before/during the match</p>
          </div>
        )}
      </div>

      {/* Match info bar */}
      <div className="px-4 py-3 bg-card border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TeamLogo url={match.homeTeam.logoUrl} name={match.homeTeam.name} shortName={match.homeTeam.shortName} className="w-7 h-7" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-foreground">
              {match.homeTeam.shortName} {match.homeScore} – {match.awayScore} {match.awayTeam.shortName}
            </span>
            <span className="text-[10px] text-muted-foreground">{match.competition}</span>
          </div>
          <TeamLogo url={match.awayTeam.logoUrl} name={match.awayTeam.name} shortName={match.awayTeam.shortName} className="w-7 h-7" />
        </div>
        {match.status === "live" && match.minute && (
          <span className="text-xs font-bold text-red-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-pulse" />
            {match.minute}
          </span>
        )}
      </div>

      {/* Stream selector */}
      {streams.length > 1 && (
        <div className="px-4 pt-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Available Streams ({streams.length})
          </p>
          <div className="grid grid-cols-2 gap-2">
            {streams.map(stream => {
              const isActive = activeStream?.id === stream.id;
              return (
                <button
                  key={stream.id}
                  onClick={() => setActiveStreamId(stream.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all",
                    isActive
                      ? "bg-primary/15 border-primary"
                      : "bg-card border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground truncate">{stream.label}</span>
                    <span className={cn(
                      "text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ml-1",
                      isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    )}>
                      {stream.quality}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{stream.language}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* URL hint for admins */}
      <div className="px-4 pt-4">
        <div className="bg-muted/40 rounded-xl border border-border/50 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground">Supported stream types</p>
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            YouTube · Twitch · Dailymotion · HLS (.m3u8) · MP4/WebM files · Any embed iframe URL
          </p>
          {activeStream && (
            <a href={toEmbedUrl(activeStream.url)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-primary mt-1">
              <ExternalLink className="w-3 h-3" /> Open stream in new tab
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
