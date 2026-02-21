import React from "react";
import { SearchIcon } from "lucide-react";
const Search = () => {
  return (
    <div className="flex gap-2 relative">
      <input className="bg-[#373737] text-gray-300 px-12 py-2 w-100 rounded-full" />
      <div className="p-2 left-2 rounded-full absolute top-1/2 -translate-y-1/2">
        <SearchIcon color="white" size={20} />
      </div>
    </div>
  );
};

export default Search;
