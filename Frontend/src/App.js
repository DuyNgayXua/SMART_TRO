import "./App.css"
import Pages from "./components/pages/Pages"
import { ThemeProvider } from "./contexts/ThemeContext"
import { AuthProvider } from "./contexts/AuthContext"
import { FavoritesProvider } from "./contexts/FavoritesContext"
import { NotificationProvider } from "./contexts/NotificationContext"
import { GoogleOAuthProvider } from '@react-oauth/google'
import ViewTrackingManager from "./components/common/ViewTrackingManager"
import "./styles/themes.css"

const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID ||
  "522368004135-fsujl8qhea0i433i3n766a9stpggdeme.apps.googleusercontent.com"

function App() {
  console.log("Google Client ID (frontend):", GOOGLE_CLIENT_ID)

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider>
        <AuthProvider>
          <FavoritesProvider>
            <NotificationProvider>
              <ViewTrackingManager />
              <Pages />
            </NotificationProvider>
          </FavoritesProvider>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  )
}

export default App
