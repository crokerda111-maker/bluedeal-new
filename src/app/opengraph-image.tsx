import { ImageResponse } from "next/og";

export const alt = "BLUEDEAL · PC 부품 가격, IT 소식과 핫딜";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", color: "white", background: "linear-gradient(135deg, #060b1a, #102b4b 65%, #07576a)", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ width: 88, height: 88, borderRadius: 25, background: "linear-gradient(135deg, #b4f6ff, #3b82f6)" }} />
        <div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>BLUEDEAL</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, display: "flex" }}>Make your next deal count.</div>
        <div style={{ fontSize: 28, color: "#a5eaf4", display: "flex" }}>PC PRICES  /  TECH  /  COMMUNITY  /  DEALS</div>
      </div>
      <div style={{ display: "flex", fontSize: 24, color: "#b8c5d8" }}>bluedeal.co.kr</div>
    </div>, size,
  );
}
