import React from 'react';

// Lazy load KaTeX to avoid SSR issues
let katex: any = null;
let katexLoaded = false;

async function loadKatex() {
  if (katexLoaded) return;
  try {
    katex = await import('katex');
    // Inject KaTeX CSS via link tag (avoids TypeScript module issues)
    if (typeof document !== 'undefined' && !document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
      document.head.appendChild(link);
    }
    katexLoaded = true;
  } catch {
    // KaTeX not available
  }
}

// Preload KaTeX
loadKatex();

function renderLatex(source: string, displayMode: boolean): string {
  if (!katex) return source;
  try {
    return katex.default.renderToString(source, {
      displayMode,
      throwOnError: false,
      trust: false,
    });
  } catch {
    return source;
  }
}

/**
 * Renders a text string that may contain LaTeX math:
 * - $...$ for inline math
 * - $$...$$ for block/display math
 */
function parseMath(text: string): React.ReactNode[] {
  if (!text) return [];

  const parts: React.ReactNode[] = [];
  // Match $$...$$ (block) or $...$ (inline)
  const regex = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const isBlock = match[1] !== undefined;
    const latex = isBlock ? match[1] : match[2];
    const html = renderLatex(latex!, isBlock);

    if (html !== latex) {
      parts.push(
        <span
          key={match.index}
          dangerouslySetInnerHTML={{ __html: html }}
          style={{ display: isBlock ? 'block' : 'inline', margin: isBlock ? '0.5em 0' : undefined }}
        />
      );
    } else {
      // KaTeX not loaded yet, show raw
      parts.push(
        <code key={match.index} className="text-indigo-600 bg-indigo-50 px-1 rounded text-xs">
          {match[0]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

type MathRendererProps = {
  text: string;
  className?: string;
  block?: boolean;
};

export function MathRenderer({ text, className = '', block = false }: MathRendererProps) {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    if (!katexLoaded) {
      loadKatex().then(() => forceUpdate());
    }
  }, []);

  const parts = parseMath(text);
  const Tag = block ? 'div' : 'span';

  return <Tag className={className}>{parts}</Tag>;
}

/** Standalone LaTeX block renderer (for AI lesson cards, etc.) */
export function LatexBlock({ latex }: { latex: string }) {
  const html = renderLatex(latex, true);
  if (html === latex) {
    return <code className="block font-mono text-sm bg-slate-50 p-3 rounded-xl">{latex}</code>;
  }
  return (
    <div
      className="overflow-x-auto py-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
