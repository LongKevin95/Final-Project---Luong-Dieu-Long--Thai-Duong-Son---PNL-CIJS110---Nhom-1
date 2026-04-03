import "./App.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-content">
        <AppRoutes />
      </main>
      <Footer />
    </div>
  );
}

export default App;
