import { useLocation } from "./router"
import { Home } from "./Home"
import { UserPage } from "./UserPage"

export function App() {
  const { path } = useLocation()
  const login = path.match(/^\/([A-Za-z\d-]{1,39})\/?$/)?.[1]
  return login ? <UserPage key={login.toLowerCase()} login={login.toLowerCase()} /> : <Home />
}
