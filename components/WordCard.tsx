import Link from "next/link";

export interface Word {
  slug: string;
  name: string;
  bodyHtml: string;
  links: string[];
}

/** Strip tags and trim to ~80 chars of flavor text. */
function flavor(html: string, max = 80): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export default function WordCard({ word }: { word: Word }) {
  return (
    <Link href={`/words/${word.slug}`} className="card">
      <small>WORD · brick</small>
      <h3>{word.name}</h3>
      <p>{flavor(word.bodyHtml)}</p>
    </Link>
  );
}
