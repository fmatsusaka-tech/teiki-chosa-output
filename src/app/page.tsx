import Link from "next/link";

const features = [
  {
    href: "/analysis",
    title: "定期調査分析",
    description: "園地・品種・処理区・年度・調査区分で、横径・糖度・酸度の推移を確認します。",
  },
  {
    href: "/orchards",
    title: "園地分析",
    description: "最大2園地を選び、調査データを比較します。",
  },
  {
    href: "/predictions",
    title: "各種予測",
    description: "横径、糖度、クエン酸の収穫時予測を表示します。",
  },
  {
    href: "/data-management",
    title: "データ管理",
    description: "Outputで利用する読取データの検索・確認を行います。",
  },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">TEIKI CHOSA OUTPUT</p>
        <h1>定期調査分析</h1>
        <p className="lead">
          Inputの「調査データ」を読取専用で利用し、比較・分析・予測を行います。
        </p>
      </section>

      <section className="feature-grid" aria-label="Outputの機能">
        {features.map((feature) => (
          <Link className="feature-card" href={feature.href} key={feature.href}>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
