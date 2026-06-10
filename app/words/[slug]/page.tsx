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
  return castle.words.map((word) => ({ slug: word.slug }));
}

export default async function WordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const castle = await loadCastle();
  const word = castle.words.find((w) => w.slug === slug);
  if (!word) notFound();

  // links are paths like "/words/bridge" or "/rooms/honest-pushback"
  const linkedWords: Word[] = [];
  const linkedRooms: Room[] = [];
  for (const href of word.links) {
    const match = href.match(/^\/(words|rooms)\/(.+)$/);
    if (!match) continue;
    if (match[1] === "words") {
      const linked = castle.words.find((w) => w.slug === match[2]);
      if (linked) linkedWords.push(linked);
    } else {
      const room = castle.rooms.find((r) => r.slug === match[2]);
      if (room) linkedRooms.push(room);
    }
  }

  return (
    <article className="card">
      <small>WORD · brick</small>
      <h1>{word.name}</h1>

      <div dangerouslySetInnerHTML={{ __html: word.bodyHtml }} />

      {linkedWords.length > 0 || linkedRooms.length > 0 ? (
        <section>
          <h2>Links</h2>
          <div className="card-grid">
            {linkedWords.map((linked) => (
              <WordCard key={linked.slug} word={linked} />
            ))}
            {linkedRooms.map((room) => (
              <RoomCard key={room.slug} room={room} />
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
