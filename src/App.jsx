import AdminPage from './admin/AdminPage.jsx'
import UserApp   from './screens/UserApp.jsx'

export default function App() {
  const isAdmin = new URLSearchParams(window.location.search).get('admin') === '1'
  return isAdmin ? <AdminPage/> : <UserApp/>
}
