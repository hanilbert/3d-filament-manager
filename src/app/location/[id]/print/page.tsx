import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LocationPrintPage({ params }: Props) {
  const { id } = await params;
  const location = await prisma.location.findUnique({ where: { id } });
  if (!location) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const qrUrl = `${baseUrl}/location/${id}`;

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
          alignItems: "center",
          background: "#fff",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* 左侧：位置名称 */}
        <div
          style={{
            flex: 1,
            padding: "3mm",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: "9pt",
              fontWeight: "bold",
              lineHeight: 1.3,
              wordBreak: "break-all",
            }}
          >
            {location.name}
          </div>
        </div>

        {/* 右侧：QR 码 */}
        <div
          style={{
            width: "28mm",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5mm",
            flexShrink: 0,
          }}
        >
          <QRCodeDisplay value={qrUrl} size={72} />
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
