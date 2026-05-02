'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';

import 'katex/dist/katex.min.css';

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-black text-slate-900 mt-8 mb-4 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-black text-slate-900 mt-7 mb-3 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-bold text-slate-900 mt-6 mb-2 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => <h4 className="text-base font-bold text-slate-800 mt-5 mb-2">{children}</h4>,
  p: ({ children }) => (
    <p className="my-3 text-slate-700 leading-relaxed first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => <ul className="my-4 ml-1 list-disc space-y-2 pl-6 text-slate-700">{children}</ul>,
  ol: ({ children }) => <ol className="my-4 ml-1 list-decimal space-y-2 pl-6 text-slate-700">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-1 marker:text-indigo-600">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-indigo-200 bg-indigo-50/60 pl-4 py-2 pr-3 my-4 rounded-r-lg text-slate-700">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-indigo-600 font-semibold underline underline-offset-2 hover:text-indigo-800"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-8 border-slate-200" />,
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt ?? ''}
      className="my-4 max-w-full h-auto rounded-xl border border-slate-200 shadow-sm"
      loading="lazy"
    />
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-100 text-slate-900">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-slate-100 last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold text-slate-900">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2.5 text-slate-700 align-top">{children}</td>,
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-slate-100 shadow-inner">{children}</pre>
  ),
  code(props) {
    const { className, children, ...rest } = props;
    const isFenced = typeof className === 'string' && className.includes('language-');
    if (isFenced) {
      return (
        <code
          className={`block w-full text-left text-[13px] font-mono leading-relaxed text-slate-100 ${className ?? ''}`}
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.9em] font-mono text-indigo-900 font-semibold"
        {...rest}
      >
        {children}
      </code>
    );
  },
};

export type MarkdownLessonProps = {
  content: string;
  className?: string;
};

/**
 * Renders AI lesson card body: GitHub-flavored markdown + LaTeX via remark-math / rehype-katex.
 */
export function MarkdownLesson({ content, className = '' }: MarkdownLessonProps) {
  return (
    <div className={`markdown-lesson max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
