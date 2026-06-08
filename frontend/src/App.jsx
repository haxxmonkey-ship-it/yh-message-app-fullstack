import { useState, useEffect } from "react"
import { BASE_URL } from "./api"
import { PostMessage } from "./components/PostMessage"
import { MessageList } from "./components/MessageList"
import { AuthModal } from "./components/AuthModal"

export const App = () => {
  const [loading, setLoading] = useState(false)
  const [messageList, setMessageList] = useState([])
  const [user, setUser] = useState(null)
  const [modal, setModal] = useState(null)
  const [error, setError] = useState(null)

  const fetchPosts = () => {
    // Om det inte finns någon inloggad användare eller token, avbryt hämtningen direkt
    if (!user?.response?.accessToken) {
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`${BASE_URL}/messages`, {
      headers: {
        // Skickar med användarens JWT-token till backend för att få godkännt att hämta meddelanden 
        Authorization: `Bearer ${user.response.accessToken}`,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          handleUnauthorized()
          return []
        }
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setMessageList(data)
        }
      })
      .catch((error) => console.error(error))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // Triggar en hämtning så fort komponenten laddas eller när 'user' ändras (t.ex. vid inloggning)
    fetchPosts()
  }, [user])

    const addNewPost = (newMessage) => {
    setMessageList((prevList) => [newMessage, ...prevList]) //prevList säkerställer att inga meddelanden försvinner om användaren klickar snabbt
   
  }

  const handleUnauthorized = () => {
    setUser(null)
    setError("Your session has expired, please log in again")
  }
    
  return (
    <>
        {user ? (
          <div className="user-info">
            <span>{user.response.username}</span>
            <button
              onClick={() => setUser(null)}
              className="auth-button"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="auth-buttons">
            <button
              onClick={() => setModal("login")}
              className="auth-button"
            >
              Login
            </button>
            <button
              onClick={() => setModal("register")}
              className="auth-button"
            >
                Register
          </button>
        </div>
      )}
      {modal && (
        <AuthModal
          mode={modal}
          onClose={() => setModal(null)}
          onSuccess={(data) => { 
            setUser(data) 
            setModal(null) 
          }}
        />
      )}
      {error && <p className="error">{error}</p>}
      <PostMessage newMessage={addNewPost} fetchPosts={fetchPosts} user={user} onUnauthorized={handleUnauthorized} />
      <MessageList
        loading={loading}
        messageList={messageList}
        setMessageList={setMessageList}
        fetchPosts={fetchPosts}
        user={user}
        onUnauthorized={handleUnauthorized}
      />
    </>
  )
}
