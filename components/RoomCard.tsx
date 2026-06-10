import Link from "next/link";

export interface Room {
  slug: string;
  title: string;
  epigraph: string;
  bodyHtml: string;
  links: string[];
  sources: { label: string; url: string }[];
}

export default function RoomCard({ room }: { room: Room }) {
  return (
    <Link href={`/rooms/${room.slug}`} className="card">
      <small>ROOM · wall</small>
      <h3>{room.title}</h3>
      {room.epigraph ? <p className="epigraph">{room.epigraph}</p> : null}
    </Link>
  );
}
