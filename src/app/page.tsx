import Link from "next/link";

const features = [
  {
    href: "/analysis",
    title: "定期調査分析",
    description: "定期調査の結果を横断的に分析します。",
  },
  {
    href: "/orchards",
    title: "園地分析",
    description: "園地のデータを時系列に分析します。",
  },
  {
    href: "/predictions",
    title: "各種予測システム",
    description: "横径、糖度、クエン酸を自由に設定して試算できます。",
  },
  {
    href: "/data-management",
    title: "データ管理",
    description: "自分が入力したデータの確認と修正申請を行えます。",
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
