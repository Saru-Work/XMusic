import { useEffect, useState } from "react";
import Album from "../components/Album";
import { Link, useNavigate } from "react-router-dom";
export interface AlbumType {
  _id: string;
  title: string;
  description: string;
  photoUrl: string;
  user: string;
}
const MyAlbums = () => {
  const [albums, setAlbums] = useState<AlbumType[] | []>([]);
  const navigate = useNavigate();
  useEffect(() => {
    fetch("http://localhost:3000/checkAuth", {
      method: "GET",
      credentials: "include",
    })
      .then((data) => data.json())
      .then((data) => {
        if (!data.authenticated) {
          navigate("/");
        }
      });
  });
  useEffect(() => {
    async function fetchMyAlbums() {
      const res = await fetch("http://localhost:3000/album/myAlbums", {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json();
      setAlbums(json.albums);
    }
    fetchMyAlbums();
  }, []);
  return (
    <div className="text-white flex">
      {albums.map((album, i) => {
        return (
          <Link to={`/album/${album._id}`}>
            <Album album={album} key={i} />
          </Link>
        );
      })}
    </div>
  );
};

export default MyAlbums;
