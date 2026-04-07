import { useState } from 'react'
import calculator from './assets/keys.png'
import timer from './assets/timer.png'
import notes from './assets/notes.png'
import screen from './assets/monitor-screen.png'
import chatbot from './assets/chatbot.png'
import './App.css'
import AppBox from './components/app-box/app-box.jsx'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        <section id="row">
          <div>
            <h1 style={{ paddingRight: '20px' }}>Productiv</h1>
          </div>
          <AppBox
            title="Calculator"
            label="Open calculator"
            icon={
              <img src={calculator} alt="Calculator" style={{ width: '90%', height: '90%' }} />
            }
          />
          <AppBox
            title="Timer"
            label="Set timer"
            icon={
              <img src={timer} alt="Timer" style={{ width: '90%', height: '90%' }} />
            }
          />
        </section>
        <section id="row">
          <AppBox
            title="Notes"
            label="Take notes"
            icon={
              <img src={notes} alt="Notes" style={{ width: '90%', height: '90%' }} />
            }
          />
          <AppBox
            title="Screen Recorder"
            label="Record screen"
            icon={
              <img src={screen} alt="Screen Recorder" style={{ width: '90%', height: '90%' }} />
            }
          />
          <AppBox
            title="Google Gemini Chatbot"
            label="Chat with Gemini"
            icon={
              <img src={chatbot} alt="Google Gemini Chatbot" style={{ width: '90%', height: '90%' }} />
            }
          />
        </section>
      </section>

      <div className="ticks"></div>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
