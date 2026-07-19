import "./globals.css";

export const metadata = {
  title: "Idea Validator — validate before you build",
  description: "Turn six focused answers into a practical validation model, ranked risks and a Go/Test/Kill verdict.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
