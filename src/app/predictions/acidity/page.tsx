import { redirect } from "next/navigation";

// 指標ごとに画面を分けていた旧構成のURL互換のためのリダイレクトのみ。
export default function AcidityPredictionPage() {
  redirect("/predictions");
}
