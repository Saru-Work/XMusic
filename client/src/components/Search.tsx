import { SearchIcon } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

const Search = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const query = params.get("q") ?? "";
  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <SearchIcon
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        key={query}
        name="q"
        type="search"
        defaultValue={query}
        aria-label="Search XMusic and YouTube"
        placeholder="Search songs, artists, or YouTube…"
        className="w-full rounded-full bg-[#373737] py-2 pl-11 pr-4 text-sm text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/40"
      />
    </form>
  );
};

export default Search;
