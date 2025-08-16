import "./App.css"
import Pages from "./components/pages/Pages"
import { ThemeProvider } from "./contexts/ThemeContext"
import "./styles/themes.css"

function App() {
  return (
    <ThemeProvider>
      <Pages />
    </ThemeProvider>
  )
}

export default App
