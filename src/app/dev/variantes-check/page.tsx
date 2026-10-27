import type { Metadata } from "next";
import { CardFace } from "@/components/card-face";
import { CARDS } from "@/lib/cards";

export const metadata: Metadata = { title: "Check variantes", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const common = CARDS.find((card) => card.rarity === "C")!;
const legendary = CARDS.find((card) => card.rarity === "L")!;
const rareHolo = CARDS.find((card) => card.rarity === "UR")!;

export default function Page() {
  return (
    <div className="holo-lab" style={{ position: "fixed", inset: 0, zIndex: 50, overflow: "auto", background: "#0b0b10", padding: 24, display: "flex", gap: 16 }}>
      <div style={{ width: 230, aspectRatio: '5/7' }}><CardFace card={common} size="md" tilt={false} className="h-full" variant="reverse" /></div>
      <div style={{ width: 230, aspectRatio: '5/7' }}><CardFace card={legendary} size="md" tilt={false} className="h-full" variant="reverse" /></div>
      <div style={{ width: 230, aspectRatio: '5/7' }}><CardFace card={common} size="md" tilt={false} className="h-full" variant="holo_blue" /></div>
      <div style={{ width: 230, aspectRatio: '5/7' }}><CardFace card={rareHolo} size="md" tilt={false} className="h-full" variant="holo_blue" /></div>
      <div style={{ width: 230, aspectRatio: '5/7' }}><CardFace card={legendary} size="md" tilt={false} className="h-full" variant="reverse" holo /></div>
      <div style={{ width: 230, aspectRatio: '5/7' }}><CardFace card={common} size="md" tilt={false} className="h-full" /></div>
    </div>
  );
}
