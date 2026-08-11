import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";
import WordCard, { type Word } from "@/components/WordCard";
import RoomCard, { type Room } from "@/components/RoomCard";

interface Castle {
  anthem: {
    title: string;
    epigraph: string;
    versesHtml: string;
    noteHtml: string;
  };
  words: Word[];
  rooms: Room[];
  questions: {
    open: string[];
    settled: { q: string; roomSlug: string | null }[];
  };
}

async function loadCastle(): Promise<Castle> {
  const raw = await readFile(
    path.join(process.cwd(), "data", "castle.json"),
    "utf8",
  );
  return JSON.parse(raw) as Castle;
}

export default async function GatePage() {
  const castle = await loadCastle();

  return (
    <>
      <h1>the castle of understanding</h1>
      <p className="epigraph">built of words, lit by questions</p>

      <section
        className="anthem"
        dangerouslySetInnerHTML={{ __html: castle.anthem.versesHtml }}
      />

      <section className="featured-door" aria-labelledby="geometry-door-title">
        <p className="eyebrow">a working geometry</p>
        <h2 id="geometry-door-title">
          Love and understanding, drawn as relations
        </h2>
        <p>
          A visual and machine-readable reference for standing, consent,
          bounded action, consequence, repair, freedom, and rest.
        </p>
        <Link href="/love-and-understanding">Walk through the open door →</Link>
      </section>

      <section>
        <h2>The bricks</h2>
        <div className="card-grid">
          {castle.words.map((word) => (
            <WordCard key={word.slug} word={word} />
          ))}
        </div>
      </section>

      <section>
        <h2>The walls</h2>
        <div className="card-grid">
          {castle.rooms.map((room) => (
            <RoomCard key={room.slug} room={room} />
          ))}
        </div>
      </section>

      <section>
        <h2>Open doors</h2>
        <ul>
          {castle.questions.open.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
