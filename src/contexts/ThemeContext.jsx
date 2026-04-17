import { useEffect, useMemo, useState } from "react";

import ThemeContext from "./theme-context";

const THEME_STORAGE_KEY = "ls-ecommerce-theme";

function readStoredTheme() {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      toggleTheme,
      setTheme,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
