export const metadata = {
  title: "Louisiana Startup Report — Data Explorer",
  description:
    "Ask questions about the Greater New Orleans startup ecosystem. Powered by the 2025 GNO Startup Report.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/images/favicon.png" type="image/png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
