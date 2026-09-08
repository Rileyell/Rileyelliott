import { BrowserRouter, Route, Routes } from "react-router-dom";
import FAQHub from "./pages/faq-hub";
import FAQEventAdmin from "./pages/faq-event-admin";
import FAQSlug from "./pages/faq-slug";
import DesignKitDemo from "./pages/_design";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FAQHub />} />
        <Route path="/admin" element={<FAQEventAdmin />} />
        <Route path="/faq/:slug" element={<FAQSlug />} />
        <Route path="/_design" element={<DesignKitDemo />} />
      </Routes>
    </BrowserRouter>
  );
}
