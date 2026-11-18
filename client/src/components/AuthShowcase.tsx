import { Link } from "react-router-dom";
import { Heart, MessageSquare, MonitorPlay, Music } from "lucide-react";

/** Bar heights (0..1) and animation offsets for the equalizer */
const BARS = [0.45, 0.8, 0.6, 1, 0.7, 0.9, 0.5, 0.75, 0.95, 0.55, 0.85, 0.65, 0.4, 0.7, 0.9, 0.6];

const FEATURES = [
  { icon: Heart, text: "Like songs and build your own playlists" },
  { icon: MonitorPlay, text: "Play anything from YouTube, right here" },
  { icon: MessageSquare, text: "Ask ChatGPT to play something for you" },
];

/** The brand side of the login / sign-up pages (large screens only) */
const AuthShowcase = () => (
  <aside className="relative hidden flex-col justify-between overflow-hidden rounded-2xl bg-[#0b0b0f] p-10 lg:flex">
    {/* Soft color glow behind the content */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-80"
      style={{
        background:
          "radial-gradient(60% 50% at 15% 10%, rgba(124,58,237,0.35), transparent 70%)," +
          "radial-gradient(50% 45% at 90% 85%, rgba(236,72,153,0.25), transparent 70%)," +
          "radial-gradient(40% 35% at 70% 30%, rgba(59,130,246,0.18), transparent 70%)",
      }}
    />

    <Link to="/" className="relative flex w-fit items-center gap-2 text-white">
      <span className="flex size-9 items-center justify-center rounded-full bg-white text-black">
        <Music size={18} />
      </span>
      <span className="text-lg font-bold tracking-tight">XMusic</span>
    </Link>

    <div className="relative flex flex-col gap-8">
      <div aria-hidden className="flex h-24 items-end gap-1.5">
        {BARS.map((height, i) => (
          <span
            key={i}
            className="eq-bar w-2.5 rounded-full bg-linear-to-t from-violet-500 to-pink-400"
            style={{ height: `${height * 100}%`, animationDelay: `${(i % 5) * -0.22}s` }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="max-w-md text-4xl leading-tight font-semibold tracking-tight text-white xl:text-5xl">
          Every song.
          <br />
          One player.
        </h2>
        <p className="max-w-md text-base text-gray-300">
          Your uploads, YouTube and your playlists, all in one place.
        </p>
      </div>
    </div>

    <ul className="relative flex flex-col gap-3">
      {FEATURES.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-3 text-sm text-gray-200">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Icon size={15} />
          </span>
          {text}
        </li>
      ))}
    </ul>
  </aside>
);

export default AuthShowcase;
