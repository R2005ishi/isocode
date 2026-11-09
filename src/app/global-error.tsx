"use client";

/**
 * Last-resort boundary: replaces the root layout, so no fonts, providers or translations are
 * available. Text is bilingual and styles are inline.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#faf8f5",
          color: "#2b2622",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Something went wrong</h1>
          <p lang="hi" style={{ marginTop: 0 }}>कुछ गड़बड़ हो गई</p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "12px 24px",
              borderRadius: 10,
              border: 0,
              background: "#b4532a",
              color: "#fff",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Try again / फिर से कोशिश करें
          </button>
        </div>
      </body>
    </html>
  );
}
