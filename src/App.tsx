import "./App.css";
import PricingTable from "./components/PricingTable";

function App() {
  return (
    <main className="app">
      <h1>LLM API 價格 Dashboard</h1>
      <p>集中比較各家大型語言模型 API 價格的儀表板。</p>
      <PricingTable />
    </main>
  );
}

export default App;
