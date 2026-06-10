import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import WordCard, { type Word } from "@/components/WordCard";
import RoomCard, { type Room } from "@/components/RoomCard";

interface Castle {
  words: Word[];
  rooms: Room[];
}

async function loadCastle(): Promise<Castle> {
  const raw = await readFile(
    path.join(process.cwd(), "data", "castle.json"),
    "utf8",
  );
  return JSON.parse(raw) as Castle;
}

export async function generateStaticParams() {
  const castle = await loadCastle();
  return castle.rooms.map((room) => ({ slug: room.slug }));
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const castle = await loadCastle();
  const room = castle.rooms.find((r) => r.slug === slug);
  if (!room) notFound();

  // links are paths like "/words/bridge" or "/rooms/honest-pushback"
  const linkedWords: Word[] = [];
  const linkedRooms: Room[] = [];
  for (const href of room.links) {
    const match = href.match(/^\/(words|rooms)\/(.+)$/);
    if (!match) continue;
    if (match[1] === "words") {
      const word = castle.words.find((w) => w.slug === match[2]);
      if (word) linkedWords.push(word);
    } else {
      const linked = castle.rooms.find((r) => r.slug === match[2]);
      if (linked) linkedRooms.push(linked);
    }
  }

  return (
    <article className="card">
      <small>ROOM · wall</small>
      <h1>{room.title}</h1>
      {room.epigraph ? <p className="epigraph">{room.epigraph}</p> : null}

      <div dangerouslySetInnerHTML={{ __html: room.bodyHtml }} />

      {room.sources.length > 0 ? (
        <section>
          <h2>Sources</h2>
          <ul>
            {room.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url}>{source.label}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {linkedRooms.length > 0 || linkedWords.length > 0 ? (
        <section>
          <h2>Links</h2>
          <div className="card-grid">
            {linkedRooms.map((linked) => (
              <RoomCard key={linked.slug} room={linked} />
            ))}
            {linkedWords.map((word) => (
              <WordCard key={word.slug} word={word} />
            ))}
          </div>
        </section>
      ) : null}

      <p>
        <Link href="/">← back to the gate</Link>
      </p>
    </article>
  );
}
