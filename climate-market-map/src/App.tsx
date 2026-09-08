import { BrowserRouter, Route, Routes } from "react-router-dom";
import MarketMap from "./pages/market-map";
import { ThemeProvider } from "@/components/theme-provider";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MarketMap />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
