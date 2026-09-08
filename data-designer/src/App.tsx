import { BrowserRouter, Route, Routes } from "react-router-dom";
import PersonaShowcase from "./pages/persona-showcase";
import { ThemeProvider } from "@/components/theme-provider";

export default function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PersonaShowcase />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
