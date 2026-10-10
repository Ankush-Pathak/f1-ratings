import { HomeView } from "@/components/home/home-view";
import { loadSummary } from "@/lib/data";

export default function Home() {
  return <HomeView summary={loadSummary()} />;
}
