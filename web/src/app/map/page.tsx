import { az } from "@/messages/az";

export const metadata = { title: az.nav.map };

export default function MapPage() {
  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl">{az.nav.map}</h1>
      <p className="mt-2 text-ink-2">{az.app.description}</p>
    </div>
  );
}
