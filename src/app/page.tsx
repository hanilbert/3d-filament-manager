import Link from "next/link";
import { LibraryBig, FlaskConical, MapPin, ArrowRight, Package2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/utils";

async function getStats() {
  const [filamentCount, spoolActiveCount, spoolEmptyCount, locationCount, brandsRaw, materialsRaw] =
    await Promise.all([
      prisma.filament.count(),
      prisma.spool.count({ where: { status: "ACTIVE" } }),
      prisma.spool.count({ where: { status: "EMPTY" } }),
      prisma.location.count(),
      prisma.filament.findMany({
        select: { brand: true, _count: { select: { spools: true } } },
      }),
      prisma.filament.findMany({ select: { material: true } }),
    ]);

  const brandMap = new Map<string, number>();
  for (const f of brandsRaw) {
    brandMap.set(f.brand, (brandMap.get(f.brand) ?? 0) + f._count.spools);
  }
  const topBrandEntry = [...brandMap.entries()].sort((a, b) => b[1] - a[1])[0];

  const materialMap = new Map<string, number>();
  for (const f of materialsRaw) {
    materialMap.set(f.material, (materialMap.get(f.material) ?? 0) + 1);
  }
  const topMaterialEntry = [...materialMap.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    filamentCount,
    brandCount: brandMap.size,
    materialCount: materialMap.size,
    spoolActiveCount,
    spoolEmptyCount,
    locationCount,
    topBrand: topBrandEntry ? { name: topBrandEntry[0], spools: topBrandEntry[1] } : null,
    topMaterial: topMaterialEntry
      ? { name: topMaterialEntry[0], count: topMaterialEntry[1] }
      : null,
  };
}

const features = [
  {
    icon: LibraryBig,
    title: "追踪您的收藏",
    desc: "添加线轴、维护有序的耗材库存，随时掌握每卷耗材的状态与位置，轻松管理使用中和已归档的线轴。",
    href: "/spools",
    linkLabel: "查看线轴",
  },
  {
    icon: FlaskConical,
    title: "按材料整理",
    desc: "按品牌和材料类型浏览耗材目录，快速检索打印参数，让每次打印都能选到最合适的耗材。",
    href: "/filaments/materials",
    linkLabel: "浏览材料",
  },
  {
    icon: MapPin,
    title: "智能位置管理",
    desc: "灵活管理存储位置，原生支持 AMS 插槽，扫描二维码即可快速定位，告别翻箱倒柜的烦恼。",
    href: "/locations",
    linkLabel: "管理位置",
  },
];

export default async function HomePage() {
  const stats = await getStats();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="px-4 pt-16 pb-12 md:px-8 md:pt-20 md:pb-16 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Package2 className="size-3.5" />
            <span>3D 打印耗材管理</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            耗材管家
          </h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg leading-relaxed">
            高效管理您的 3D 打印耗材线轴。
            <br className="hidden sm:block" />
            追踪库存、整理收藏，让耗材管理井井有条。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/spools"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              查看我的线轴
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/filaments/new"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              添加新耗材
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 pb-10 md:px-8">
        <div className="mx-auto max-w-5xl grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {/* 品牌 */}
          <Link
            href="/filaments"
            className="group rounded-xl border border-border bg-card p-4 md:p-5 transition-colors hover:bg-muted/40"
          >
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <LibraryBig className="size-3.5" />
              品牌
            </p>
            <p className="text-2xl font-bold md:text-3xl">{formatNumber(stats.brandCount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">个品牌</p>
            {stats.topBrand && (
              <div className="mt-3 pt-3 border-t border-border/60">
                <p className="text-xs text-muted-foreground">线轴最多</p>
                <p className="text-sm font-medium truncate">{stats.topBrand.name}</p>
                <p className="text-xs text-muted-foreground">{formatNumber(stats.topBrand.spools)} 个线轴</p>
              </div>
            )}
          </Link>

          {/* 耗材目录 */}
          <Link
            href="/filaments"
            className="group rounded-xl border border-border bg-card p-4 md:p-5 transition-colors hover:bg-muted/40"
          >
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <FlaskConical className="size-3.5" />
              耗材目录
            </p>
            <p className="text-2xl font-bold md:text-3xl">{formatNumber(stats.filamentCount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">个耗材条目</p>
            {stats.topMaterial && (
              <div className="mt-3 pt-3 border-t border-border/60">
                <p className="text-xs text-muted-foreground">最多条目材料</p>
                <p className="text-sm font-medium">{stats.topMaterial.name}</p>
                <p className="text-xs text-muted-foreground">{formatNumber(stats.topMaterial.count)} 个条目</p>
              </div>
            )}
          </Link>

          {/* 材料种类 */}
          <Link
            href="/filaments/materials"
            className="group rounded-xl border border-border bg-card p-4 md:p-5 transition-colors hover:bg-muted/40"
          >
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <FlaskConical className="size-3.5" />
              材料种类
            </p>
            <p className="text-2xl font-bold md:text-3xl">{formatNumber(stats.materialCount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">种材料</p>
            <div className="mt-3 pt-3 border-t border-border/60">
              <p className="text-xs text-muted-foreground">存储位置</p>
              <p className="text-2xl font-bold">{formatNumber(stats.locationCount)}</p>
              <p className="text-xs text-muted-foreground">个位置</p>
            </div>
          </Link>

          {/* 我的线轴 */}
          <Link
            href="/spools"
            className="group rounded-xl border border-border bg-card p-4 md:p-5 transition-colors hover:bg-muted/40"
          >
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Package2 className="size-3.5" />
              我的线轴
            </p>
            <p className="text-2xl font-bold md:text-3xl">{formatNumber(stats.spoolActiveCount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">个使用中</p>
            <div className="mt-3 pt-3 border-t border-border/60">
              <p className="text-xs text-muted-foreground">已归档线轴</p>
              <p className="text-2xl font-bold">{formatNumber(stats.spoolEmptyCount)}</p>
              <p className="text-xs text-muted-foreground">个已用完</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-10 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            功能亮点
          </h2>
          <div className="grid gap-3 md:grid-cols-3 md:gap-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.href}
                  className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-4 text-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">{f.desc}</p>
                  <Link
                    href={f.href}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {f.linkLabel}
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-border bg-muted/40 px-6 py-8 text-center md:py-10">
            <h2 className="text-lg font-semibold md:text-xl">准备好管理您的耗材收藏了吗？</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              立即开始追踪您的线轴库存，或浏览已录入的耗材数据。
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/spools"
                className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
              >
                查看我的线轴
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/filaments"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                浏览耗材目录
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
