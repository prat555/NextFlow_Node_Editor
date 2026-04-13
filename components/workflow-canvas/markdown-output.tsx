"use client"

import React from "react"
import ReactMarkdown from "react-markdown"

interface MarkdownOutputProps {
  content: string
  canvasMode: "light" | "dark"
}

export function MarkdownOutput({ content, canvasMode }: MarkdownOutputProps) {
  return (
    <div
      className={`max-h-75 overflow-y-auto rounded-lg p-3 text-xs leading-relaxed ${
        canvasMode === "light"
          ? "bg-gray-50 text-gray-700 border border-gray-200"
          : "bg-[#0a0a0a] text-[#aaa] border border-[#1a1a1a]"
      }`}
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: canvasMode === "light" ? "#d1d5db #f3f4f6" : "#333 #0f0f10",
        scrollbarGutter: "stable",
      }}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className={`font-bold text-sm mb-2 ${canvasMode === "light" ? "text-gray-900" : "text-white"}`}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={`font-bold text-[13px] mb-1.5 ${canvasMode === "light" ? "text-gray-900" : "text-white"}`}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`font-semibold text-[12px] mb-1 ${canvasMode === "light" ? "text-gray-800" : "text-gray-200"}`}>
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2">{children}</p>,
          ul: ({ children }) => (
            <ul className={`mb-2 ml-4 list-disc ${canvasMode === "light" ? "text-gray-700" : "text-[#bbb]"}`}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={`mb-2 ml-4 list-decimal ${canvasMode === "light" ? "text-gray-700" : "text-[#bbb]"}`}>
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="mb-1">{children}</li>,
          code: ({ children }) => (
            <code
              className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${
                canvasMode === "light"
                  ? "bg-gray-200 text-gray-900"
                  : "bg-[#1a1a1a] text-[#e0e0e0]"
              }`}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              className={`rounded-lg p-2 mb-2 overflow-x-auto font-mono text-[10px] ${
                canvasMode === "light"
                  ? "bg-gray-100 text-gray-900 border border-gray-200"
                  : "bg-[#1a1a1a] text-[#e0e0e0] border border-[#2a2a2a]"
              }`}
            >
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={`mb-2 pl-3 border-l-2 italic ${
                canvasMode === "light"
                  ? "border-gray-300 text-gray-600"
                  : "border-[#333] text-[#999]"
              }`}
            >
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline ${canvasMode === "light" ? "text-blue-600 hover:text-blue-800" : "text-blue-400 hover:text-blue-300"}`}
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className={`font-semibold ${canvasMode === "light" ? "text-gray-900" : "text-white"}`}>{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className={`my-2 ${canvasMode === "light" ? "border-gray-300" : "border-[#333]"}`} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
