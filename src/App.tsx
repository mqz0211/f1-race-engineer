import { useEffect, useRef, useState } from 'react'
import {
  advanceRaceState,
  generateDriverReply,
  initialRaceState,
  makeMessage,
  type RadioMessage,
  type RaceState,
} from './lib/race-engine'

type SpeechResultEvent = { results: ArrayLike<{ 0: { transcript: string } }> }
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

const initialMessages: RadioMessage[] = [
  makeMessage('engineer', 'Push, maintain position.'),
  makeMessage('driver', "Copy. I'll push. Rear tyres are feeling okay, but the front is still sliding through Maggotts."),
]

const radioOptions = [
  {
    title: 'Tell him to manage his tyres.',
    detail: 'Ask the driver to protect the front tyres and preserve grip.',
    message: 'Manage the tyres. Avoid pushing too hard through the high-speed corners.',
  },
  {
    title: 'Bring him into the pits.',
    detail: 'Call the driver into pit lane for a fresh set of tyres.',
    message: 'Box this lap. We are bringing you in for a new set of tyres.',
  },
  {
    title: 'Tell him to keep pushing.',
    detail: 'Ask for more pace to close the gap to the car ahead.',
    message: 'Keep pushing. We need to catch P7.',
  },
  {
    title: 'Ask for more information.',
    detail: 'Get a clearer report before making a strategy decision.',
    message: 'Can you give me more information about the front sliding?',
  },
]

export default function App() {
  const [race, setRace] = useState<RaceState>(initialRaceState)
  const [messages, setMessages] = useState<RadioMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [radioEnabled, setRadioEnabled] = useState(true)
  const [notice, setNotice] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  const Recognition = typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => () => {
    recognitionRef.current?.stop()
    window.speechSynthesis?.cancel()
  }, [])

  function playRadioClick() {
    if (!radioEnabled) return
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      const context = new AudioContextClass()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(920, context.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(520, context.currentTime + 0.055)
      gain.gain.setValueAtTime(0.025, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.075)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.08)
      oscillator.onended = () => void context.close()
    } catch {
      // The radio remains usable when audio effects are unavailable.
    }
  }

  function speak(text: string) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-GB'
    utterance.rate = 0.94
    utterance.pitch = 0.92
    const voices = window.speechSynthesis.getVoices()
    const britishVoice = voices.find((voice) => voice.lang.toLowerCase() === 'en-gb')
    if (britishVoice) utterance.voice = britishVoice
    window.speechSynthesis.speak(utterance)
  }

  async function sendRadioCall(value: string) {
    const text = value.trim()
    if (!text || busy) return

    setBusy(true)
    setDraft('')
    setNotice('')
    setMessages((current) => [...current, makeMessage('engineer', text)])
    playRadioClick()

    await new Promise((resolve) => window.setTimeout(resolve, 520))

    const nextRace = advanceRaceState(text, race)
    const reply = generateDriverReply(text, nextRace)
    setRace(nextRace)
    setMessages((current) => [...current, makeMessage('driver', reply)])
    playRadioClick()
    speak(reply)
    setBusy(false)

    if (nextRace.lap >= nextRace.totalLaps) {
      setNotice('Chequered flag. The simulated race has reached the final lap.')
    }
  }

  function startListening() {
    if (!Recognition || listening || busy) return
    const recognition = new Recognition()
    recognition.lang = 'en-GB'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) void sendRadioCall(transcript)
    }
    recognition.onerror = () => {
      setListening(false)
      setNotice('Microphone unavailable. Check browser permission or use the text radio.')
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    setNotice('Listening — speak your instruction, then release the radio.')
    try {
      recognition.start()
    } catch {
      setListening(false)
      setNotice('Could not start the microphone. Use the text radio instead.')
    }
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  function resetSession() {
    setRace(initialRaceState)
    setMessages(initialMessages)
    setDraft('')
    setNotice('Session reset to lap 12.')
    window.speechSynthesis?.cancel()
  }

  const frontCondition = race.frontCondition.toLowerCase()
  const pitWindow = race.pitWindow === 'OPEN' ? 'Open' : 'Not yet'

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Apex Race Engineer home">
          <span className="brand-mark">A<span>/</span></span>
          <span className="brand-copy"><strong>APEX</strong><small>RACE ENGINEERING</small></span>
        </a>
        <div className="session-meta">
          <span className="live-dot" />
          <span>LIVE SIMULATION</span>
          <i />
          <span>{race.track.toUpperCase()} GRAND PRIX</span>
          <i />
          <span>LAP {race.lap} / {race.totalLaps}</span>
        </div>
        <div className="top-actions">
          <button className={`icon-button ${voiceEnabled ? 'selected' : ''}`} onClick={() => setVoiceEnabled((value) => !value)} aria-label="Toggle driver voice" title="Toggle driver voice">♫</button>
          <button className={`icon-button ${radioEnabled ? 'selected' : ''}`} onClick={() => setRadioEnabled((value) => !value)} aria-label="Toggle radio effects" title="Toggle radio effects">◖</button>
          <button className="reset-button" onClick={resetSession}>RESET</button>
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">PIT WALL <span>/</span> DRIVER COMMUNICATIONS</p>
          <h1>You are the race engineer<span>.</span></h1>
          <p className="subheading">Your driver is on track. You make the calls.</p>
        </div>
        <div className="session-chip">
          <span className="session-chip-label">CURRENT POSITION</span>
          <strong>P{race.position}</strong>
          <small>{race.driver} · {race.team}</small>
        </div>
      </section>

      <section className="race-strip" aria-label="Race session">
        <div><span>SESSION</span><strong>{race.track} GP</strong></div>
        <div><span>LAP</span><strong>{race.lap}<small> / {race.totalLaps}</small></strong></div>
        <div><span>POSITION</span><strong>P{race.position}</strong></div>
        <div><span>WEATHER</span><strong>{race.weather}</strong></div>
      </section>

      <section className="radio-section">
        <div className="section-heading">
          <div><span className="section-index">01</span><span>TEAM RADIO</span></div>
          <span className="channel"><i /> CHANNEL 07.4</span>
        </div>

        <div className="radio-panel">
          <div className="radio-feed" ref={feedRef} aria-live="polite">
            {messages.map((message, index) => (
              <article className={`message ${message.from}`} key={message.id}>
                <div className="message-heading">
                  <span className="message-avatar">{message.from === 'engineer' ? 'YOU' : 'DR'}</span>
                  <div>
                    <strong>{message.from === 'engineer' ? 'YOU — RACE ENGINEER' : `DRIVER — P${race.position}`}</strong>
                    <small>{message.from === 'engineer' ? 'OUTGOING RADIO' : 'INCOMING RADIO'}</small>
                  </div>
                  <time>{message.time}</time>
                </div>
                <p className="message-text">“{message.text}”</p>
                {message.from === 'engineer' && index === 0 && <span className="delivery-note">✓ Message received by driver.</span>}
              </article>
            ))}
            {busy && (
              <div className="driver-thinking">
                <span className="thinking-dots"><i /><i /><i /></span>
                DRIVER RESPONDING
              </div>
            )}
          </div>
          {notice && <div className="notice-line">{notice}</div>}
        </div>
      </section>

      <section className="situation-section">
        <div className="section-heading">
          <div><span className="section-index">02</span><span>NEW SITUATION</span></div>
          <span className="muted-label">SIMULATED RACE DATA</span>
        </div>
        <div className="situation-grid">
          <article className="situation-card">
            <span className="situation-label">GAP TO P{Math.max(1, race.position - 1)}</span>
            <strong className="gap-number">+{race.gapAhead.toFixed(1)}<small>s</small></strong>
            <span className="situation-foot">Car ahead</span>
          </article>
          <article className="situation-card">
            <span className="situation-label">TYRE CONDITION</span>
            <strong className={`condition-value condition-${frontCondition}`}>Front: {frontCondition}</strong>
            <span className="situation-foot">Rear: {race.rearCondition.toLowerCase()}</span>
          </article>
          <article className="situation-card">
            <span className="situation-label">PIT WINDOW</span>
            <strong className={`pit-value ${race.pitWindow === 'OPEN' ? 'is-open' : ''}`}>{pitWindow}</strong>
            <span className="situation-foot">{race.tyreCompound} tyres · simulated</span>
          </article>
        </div>
        <p className="situation-context">
          <span className="context-dot" />
          {race.frontCondition === 'CRITICAL'
            ? 'Front tyre condition is critical. Consider bringing the car in.'
            : race.frontCondition === 'DEGRADING'
              ? 'The driver has reported front tyre sliding through Maggotts.'
              : 'Tyre condition is stable. Keep monitoring the driver feedback.'}
        </p>
      </section>

      <section className="decision-section">
        <div className="section-heading">
          <div><span className="section-index">03</span><span>YOUR NEXT RADIO CALL</span></div>
          <span className="muted-label">CHOOSE A RESPONSE</span>
        </div>
        <p className="decision-prompt">The driver is reporting front tyre sliding. What do you want to do?</p>
        <div className="option-grid">
          {radioOptions.map((option, index) => (
            <button className="option-card" key={option.title} onClick={() => void sendRadioCall(option.message)} disabled={busy}>
              <span className="option-number">0{index + 1}</span>
              <span className="option-copy"><strong>{option.title}</strong><small>{option.detail}</small></span>
              <span className="option-arrow">↗</span>
            </button>
          ))}
        </div>
        <div className="beginner-note">
          <span className="beginner-mark">i</span>
          <p><strong>New to race engineering?</strong> These are suggested radio calls. Choose one to hear how your driver responds, or make up your own instruction below.</p>
        </div>
      </section>

      <section className="transmit-section">
        <div className="section-heading">
          <div><span className="section-index">04</span><span>YOUR RADIO</span></div>
          <span className="muted-label">FREEFORM COMMUNICATION</span>
        </div>
        <form className="radio-composer" onSubmit={(event) => { event.preventDefault(); void sendRadioCall(draft) }}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Or write your own radio call…"
            aria-label="Write your own radio call"
            disabled={busy}
          />
          <button type="submit" className="transmit-button" disabled={!draft.trim() || busy}>TRANSMIT <span>↗</span></button>
        </form>
        <div className="composer-footer">
          <span>Speak naturally. You do not need to know every F1 term.</span>
          <button
            className={`ptt-button ${listening ? 'listening' : ''}`}
            onPointerDown={(event) => { event.preventDefault(); startListening() }}
            onPointerUp={stopListening}
            onPointerLeave={stopListening}
            onPointerCancel={stopListening}
            disabled={!Recognition || busy}
            title={Recognition ? 'Hold to speak' : 'Speech recognition is not supported in this browser'}
          >
            <span className="mic-icon">●</span>
            {listening ? 'LISTENING…' : 'HOLD TO SPEAK'}
          </button>
        </div>
      </section>

      <footer className="disclaimer">
        <span>APEX RACE ENGINEERING</span><i /> INDEPENDENT RACE SIMULATION <i /> TELEMETRY IS ILLUSTRATIVE
      </footer>
    </main>
  )
}
