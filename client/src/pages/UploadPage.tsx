import { useState } from "react";

const UploadPage = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  return (
    <div className="w-full h-screen flex items-center justify-center">
      <form
        className="bg-slate-400 w-max p-5"
        action="/upload"
        onSubmit={(e) => {
          const formData = new FormData();
          e.preventDefault();
          formData.append("audio", files[0]);
          formData.append("name", name);
          fetch("http://localhost:3000/songs/upload", {
            method: "POST",
            body: formData,
          });
          Array.from(formData.values()).forEach((element) => {
            console.log(element);
          });
        }}
      >
        <div>
          <label>Name: </label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            type="text"
            className="bg-slate-200 text-sm rounded-md border border-black py-1 px-2"
          />
        </div>
        <div className="my-2">
          <label
            className="border border-black px-2 py-1 rounded-sm"
            htmlFor="file-browse"
          >
            Browse Music
          </label>
          <input
            multiple
            name="audio"
            type="file"
            id="file-browse"
            className="w-0"
            onChange={(e) => {
              setFiles(Array.from(e.target.files || []));
            }}
          />
        </div>
        <div>
          {files.map((file, i) => {
            return (
              <div
                className="text-black bg-white border border-black rounded-sm m-2"
                key={i}
              >
                {file.name}
              </div>
            );
          })}
        </div>
        <button className="bg-gray-700 text-white text-sm px-2 py-1 rounded-sm cursor-pointer">
          Upload
        </button>
      </form>
    </div>
  );
};

export default UploadPage;
