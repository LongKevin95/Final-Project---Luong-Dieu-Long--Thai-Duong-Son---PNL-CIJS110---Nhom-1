import { Outlet } from "react-router-dom";

import Header from "./Header";
import Footer from "./Footer";

export default function PublicLayout() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
