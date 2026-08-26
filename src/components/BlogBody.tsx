import React from "react";

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export default function BlogBody({ body }: { body: string }) {
  const lines = body.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-5 list-disc space-y-2 pl-6 text-white/75">
        {items.map((item, index) => <li key={index}>{renderInline(item)}</li>)}
      </ul>,
    );
  };

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      listItems.push(line.slice(2).trim());
      return;
    }
    flushList();
    if (!line) return;
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={index} className="mb-3 mt-8 text-lg font-semibold">{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      blocks.push(<h2 key={index} className="mb-3 mt-10 text-2xl font-semibold tracking-tight">{renderInline(line.slice(3))}</h2>);
    } else {
      blocks.push(<p key={index} className="my-4 leading-8 text-white/75">{renderInline(line)}</p>);
    }
  });
  flushList();

  return <div>{blocks}</div>;
}

