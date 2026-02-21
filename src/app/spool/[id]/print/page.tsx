import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SpoolPrintPage({ params }: Props) {
  const { id } = await params;
  const spool = await prisma.spool.findUnique({
    where: { id },
    include: { globalFilament: true },
  });

  if (!spool) notFound();

  const gf = spool.globalFilament;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const qrUrl = `${baseUrl}/spool/${id}`;

  // 计算文字颜色（确保与背景对比度）
  function getTextColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? "#000000" : "#ffffff";
  }

  const bgColor = gf.color_hex ?? null;
  const textColor = bgColor ? getTextColor(bgColor) : "#000000";

  return (
    <>
      <style>{`
        @page { size: 40mm 30mm; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { width: 40mm; height: 30mm; overflow: hidden; }
        @media screen {
          body { background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .label { box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        }
      `}</style>
      <div
        className="label"
        style={{
          width: "40mm",
          height: "30mm",
          display: "flex",
          fontFamily: "sans-serif",
          background: "#fff",
          overflow: "hidden",
        }}
      >
        {/* 左侧信息区（65%） */}
        <div
          style={{
            width: "65%",
            padding: "2mm",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          {/* 品牌 + 材质 */}
          <div>
            <div
              style={{
                fontSize: "6pt",
                color: "#666",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {gf.brand}
            </div>
            <div
              style={{
                display: "inline-block",
                background: bgColor ?? "#e5e7eb",
                color: textColor,
                fontWeight: "bold",
                fontSize: "7pt",
                padding: "0.5mm 1.5mm",
                borderRadius: "1mm",
                marginTop: "0.5mm",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {gf.material.toUpperCase()}
            </div>
          </div>

          {/* 参数信息 */}
          <div style={{ fontSize: "5pt", color: "#444", lineHeight: 1.4 }}>
            <div>喷嘴 {gf.nozzle_temp}</div>
            <div>热床 {gf.bed_temp}</div>
            <div>速度 {gf.print_speed}</div>
            <div
              style={{
                marginTop: "0.5mm",
                color: "#222",
                fontWeight: "bold",
                fontSize: "5.5pt",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {gf.color_name}
            </div>
          </div>
        </div>

        {/* 右侧二维码区（35%） */}
        <div
          style={{
            width: "35%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5mm",
          }}
        >
          <QRCodeDisplay value={qrUrl} size={64} />
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `window.addEventListener('load', () => window.print())`,
        }}
      />
    </>
  );
}
