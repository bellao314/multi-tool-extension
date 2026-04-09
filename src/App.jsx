import { useState } from 'react'
import calculator from './assets/keys.png'
import timer from './assets/timer.png'
import notes from './assets/notes.png'
import screen from './assets/monitor-screen.png'
import chatbot from './assets/chatbot.png'
import './App.css'
import AppBox from './components/app-box/app-box.jsx'

function App() {
  return (
    <>
      <section id="center">
        <section id="row">
          <AppBox
            title={<h2>Productiv</h2>}
            description="An all-in-one productivity tool"
            disabled={true}
          />
          <AppBox
            title="Calculator"
            description="Perform calculations"
            icon={
              <img src={calculator} alt="Calculator" style={{ width: '90%', height: '90%' }} />
            }
          />
        </section>
        <section id="row">
          <AppBox
            title="Timer"
            description="Set a timer"
            icon={
              <img src={timer} alt="Timer" style={{ width: '90%', height: '90%' }} />
            }
          />
          <AppBox
            title="Notes"
            description="Take notes"
            icon={
              <img src={notes} alt="Notes" style={{ width: '90%', height: '90%' }} />
            }
          />
        </section>
        <section id="row">
          <AppBox
            title="Screen Recorder"
            description="Record your screen"
            icon={
              <img src={screen} alt="Screen Recorder" style={{ width: '90%', height: '90%' }} />
            }
          />
          <AppBox
            title="AI Chatbot"
            description="Chat with Google Gemini"
            icon={
              <img src={chatbot} alt="Google Gemini Chatbot" style={{ width: '90%', height: '90%' }} />
            }
          />
        </section>
      </section>
    </>
  )
}

export default App
