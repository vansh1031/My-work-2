// Renders the simple Markdown used in config/legal/*.md: headings (#, ##, ###) and paragraphs. Nothing else is
// needed there, and rendering text this way means a legal file can never inject HTML into the app.
export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="markdown">
      {blocks.map((block, i) => {
        const h = /^(#{1,3})\s+(.*)$/.exec(block);
        if (h) {
          const level = h[1]!.length;
          if (level === 1) return <h1 key={i}>{h[2]}</h1>;
          if (level === 2) return <h2 key={i}>{h[2]}</h2>;
          return <h3 key={i}>{h[2]}</h3>;
        }
        return <p key={i}>{block.replace(/\n/g, " ")}</p>;
      })}
    </div>
  );
}
