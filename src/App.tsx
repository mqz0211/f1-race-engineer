import { useEffect, useRef, useState } from 'react'
import {
  advanceLap,
  generateEngineerReply,
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
  makeMessage('engineer', 'Radio check. Loud and clear. We are on lap 18, P7. Tyres are holding up well. Let me know what you need.'),
]

function TrackMap() {
  return (
    <svg className="track-map" viewBox="0 0 520 290" role="img" aria-label="Illustrative circuit map">
      <path className="track-shadow" d="M84 168 C56 145 67 89 116 72 L178 52 C211 42 237 49 250 75 L278 120 C293 145 316 151 346 136 L385 115 C413 100 450 111 455 141 L460 179 C465 210 439 232 407 225 L341 211 C305 200 282 211 262 238 C238 267 197 253 183 222 L163 184 C150 160 119 182 84 168Z" />
      <path className="track-line" d="M84 168 C56 145 67 89 116 72 L178 52 C211 42 237 49 250 75 L278 120 C293 145 316 151 346 136 L385 115 C413 100 450 111 455 141 L460 179 C465 210 439 232 407 225 L341 211 C305 200 282 211 262 238 C238 267 197 253 183 222 L163 184 C150 160 119 182 84 168Z" />
      <path className="track-centre" d="M84 168 C56 145 67 89 116 72 L178 52 C211 42 237 49 250 75 L278 120 C293 145 316 151 346 136 L385 115 C413 100 450 111 455 141 L460 179 C465 210 439 232 407 225 L341 211 C305 200 282 211 262 238 C238 267 197 253 183 222 L163 184 C150 160 119 182 84 168Z" />
      <path className="track-sector" d="M84 168 C56 145 67 89 116 72 L178 52" />
      <circle className="track-dot" cx="84" cy="168" r="7" />
      <text x="68" y="194">START / FINISH</text>
      <text x="365" y="92">SECTOR 2</text>
      <text x="190" y="273">SECTOR 3</text>
      <circle className="track-car" cx="278" cy="120" r="5" />
    </svg>
  )
}

function Stat({ label, value, unit, accent = false }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <div className={`stat-value ${accent ? 'accent' : ''}`}>{value}<small>{unit}</small></div>
    </div>
  )
}

export default function App() {
  const [race, setRace] = useState<RaceState>(initialRaceState)
  const [messages, setMessages] = useState<RadioMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [radioEnabled, setRadioEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const recognitionSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  const apiUrl = import.meta.env.VITE_ENGINEER_API_URL as string | undefined

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

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
      gain.gain.setValueAtTime(0.035, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.075)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.08)
      oscillator.onended = () => void context.close()
    } catch {
      // Audio is an enhancement; the radio remains usable without it.
    }
  }

  function speak(text: string) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-GB'
    utterance.rate = 0.96
    utterance.pitch = 0.94
    const voices = window.speechSynthesis.getVoices()
    const britishVoice = voices.find((voice) => voice.lang.toLowerCase() === 'en-gb')
      || voices.find((voice) => voice.lang.toLowerCase().startsWith('en-gb'))
    if (britishVoice) utterance.voice = britishVoice
    window.speechSynthesis.speak(utterance)
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setDraft('')
    const driverMessage = makeMessage('driver', trimmed)
    setMessages((current) => [...current, driverMessage])
    playRadioClick()

    let reply = ''
    try {
      if (apiUrl) {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, raceState: race }),
        })
        if (!response.ok) throw new Error(`Engineer endpoint returned ${response.status}`)
        const payload = await response.json() as { reply?: string }
        if (!payload.reply) throw new Error('The engineer endpoint did not return a reply.')
        reply = payload.reply
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 420))
        reply = generateEngineerReply(trimmed, race)
      }
    } catch (error) {
      reply = 'I have lost the strategy data link. The local radio fallback is available: ' + generateEngineerReply(trimmed, race)
      setNotice(error instanceof Error ? error.message : 'AI endpoint unavailable')
    }

    const engineerMessage = makeMessage('engineer', reply)
    setMessages((current) => [...current, engineerMessage])
    playRadioClick()
    speak(reply)
    setBusy(false)
  }

  function startListening() {
    if (!recognitionSupported || listening || busy) return
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) return
    const recognition = new Recognition()
    recognition.lang = 'en-GB'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) void sendMessage(transcript)
    }
    recognition.onerror = () => {
      setListening(false)
      setNotice('Microphone recognition stopped. Check browser microphone permission or use the text radio.')
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    setNotice('Listening — release the radio button to send.')
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

  function updateRace(next: (state: RaceState) => RaceState) {
    setRace((current) => next(current))
  }

  function toggleWeather() {
    updateRace((current) => ({ ...current, weather: current.weather === 'DRY' ? 'LIGHT RAIN' : current.weather === 'LIGHT RAIN' ? 'WET' : 'DRY' }))
  }

  function toggleSafetyCar() {
    updateRace((current) => ({ ...current, safetyCar: !current.safetyCar }))
  }

  function resetSession() {
    setRace(initialRaceState)
    setMessages(initialMessages)
    setNotice('Session reset to the opening race scenario.')
    window.speechSynthesis?.cancel()
  }

  const progress = (race.lap / race.totalLaps) * 100
  const tyreStatus = race.tyreWear >= 72 ? 'critical' : race.tyreWear >= 55 ? 'warning' : 'good'

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Apex Race Engineer home">
          <span className="brand-mark">A<span>/</span></span>
          <span className="brand-copy"><strong>APEX</strong><small>RACE ENGINEERING</small></span>
        </a>
        <div className="session-meta">
          <span className="live-dot" />
          <span>SIMULATION LIVE</span>
          <i />
          <span>GRAND PRIX</span>
          <i />
          <span>{race.track.toUpperCase()}</span>
        </div>
        <div className="top-actions">
          <button className={`icon-button ${voiceEnabled ? 'selected' : ''}`} onClick={() => setVoiceEnabled((value) => !value)} title="Toggle engineer voice" aria-label="Toggle engineer voice">
            <span className="sound-icon">♫</span>
          </button>
          <button className={`icon-button ${radioEnabled ? 'selected' : ''}`} onClick={() => setRadioEnabled((value) => !value)} title="Toggle radio effects" aria-label="Toggle radio effects">◖</button>
          <button className="reset-button" onClick={resetSession}>RESET SESSION</button>
        </div>
      </header>

      <section className="race-heading">
        <div>
          <p className="eyebrow">RACE CONTROL <span>/</span> DRIVER COMMUNICATIONS</p>
          <h1>Race engineer<span>.</span></h1>
          <p className="subheading">Your pit wall. Your call. Every lap counts.</p>
        </div>
        <div className="lap-widget">
          <div className="lap-number"><strong>{String(race.lap).padStart(2, '0')}</strong><span>/ {race.totalLaps}</span></div>
          <div className="lap-track"><span style={{ width: `${progress}%` }} /></div>
          <small>RACE PROGRESS</small>
        </div>
      </section>

      <section className="dashboard">
        <aside className="column telemetry-column">
          <div className="section-heading"><span>01 / CAR TELEMETRY</span><span className="muted">LIVE SIM</span></div>
          <div className="panel position-panel">
            <div className="position-top"><span>RUNNING POSITION</span><span className="position-change">—</span></div>
            <div className="position-number">P{race.position}<small> / 20</small></div>
            <div className="position-foot"><span>{race.driver}</span><span>{race.team}</span></div>
          </div>
          <div className="panel telemetry-panel">
            <div className="panel-title">INTERVALS <span>GAP / SEC</span></div>
            <Stat label="CAR AHEAD" value={race.gapAhead.toFixed(1)} unit="s" accent />
            <div className="hairline" />
            <Stat label="CAR BEHIND" value={race.gapBehind.toFixed(1)} unit="s" />
            <div className="hairline" />
            <Stat label="FUEL PREDICTION" value={`${race.fuelDelta >= 0 ? '+' : ''}${race.fuelDelta.toFixed(1)}`} unit="laps" accent={race.fuelDelta < 0} />
          </div>
          <div className="panel conditions-panel">
            <div className="panel-title">TRACK CONDITIONS <span>ENVIRONMENT</span></div>
            <div className="condition-row"><span>TRACK TEMP.</span><strong>{race.trackTemp}°C</strong></div>
            <div className="condition-row"><span>AIR TEMP.</span><strong>{race.airTemp}°C</strong></div>
            <div className="condition-row"><span>WEATHER</span><strong className={race.weather === 'DRY' ? '' : 'weather-alert'}>{race.weather}</strong></div>
            <div className="condition-row"><span>SAFETY CAR</span><strong className={race.safetyCar ? 'weather-alert' : ''}>{race.safetyCar ? 'DEPLOYED' : 'NONE'}</strong></div>
          </div>
        </aside>

        <section className="column centre-column">
          <div className="section-heading"><span>02 / CIRCUIT OVERVIEW</span><span className="muted">SCHEMATIC</span></div>
          <div className="panel circuit-panel">
            <div className="circuit-head"><div><span className="eyebrow">ROUND 01</span><h2>{race.track}<span>.</span></h2></div><div className="circuit-tag">GBR <b>◆</b></div></div>
            <TrackMap />
            <div className="circuit-footer"><span><i className="legend-dot car" /> CAR POSITION</span><span>5.891 KM <b>·</b> 18 CORNERS</span></div>
          </div>

          <div className="section-heading radio-heading"><span>03 / TEAM RADIO</span><span className="muted">{messages.length.toString().padStart(2, '0')} TRANSMISSIONS</span></div>
          <div className="panel radio-panel">
            <div className="radio-top"><div><span className="radio-indicator" /> <strong>ENGINEER CHANNEL</strong></div><span className="mono">CH 07.4</span></div>
            <div className="radio-feed" ref={feedRef}>
              {messages.map((message) => (
                <article className={`message ${message.from}`} key={message.id}>
                  <div className="message-meta"><strong>{message.from === 'driver' ? 'DRIVER' : 'RACE ENGINEER'}</strong><time>{message.time}</time></div>
                  <p>{message.text}</p>
                </article>
              ))}
              {busy && <div className="thinking"><span /><span /><span /> ENGINEER IS RESPONDING</div>}
            </div>
            {notice && <div className="notice-line">{notice}</div>}
            <form className="radio-input" onSubmit={(event) => { event.preventDefault(); void sendMessage(draft) }}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Talk to your engineer…" aria-label="Message your race engineer" />
              <button type="submit" disabled={!draft.trim() || busy} className="send-button">SEND <span>↗</span></button>
            </form>
          </div>
        </section>

        <aside className="column strategy-column">
          <div className="section-heading"><span>04 / STRATEGY</span><span className="muted">PIT WALL</span></div>
          <div className="panel tyre-panel">
            <div className="panel-title">TYRE MANAGEMENT <span>SET 02</span></div>
            <div className="tyre-graphic"><div className="tyre-ring"><div className="tyre-inner"><strong>{race.tyreWear}<small>%</small></strong><span>EST. WEAR</span></div></div></div>
            <div className="tyre-details"><div><span>COMPOUND</span><strong className={`compound ${race.tyreCompound.toLowerCase()}`}>{race.tyreCompound}</strong></div><div><span>CONDITION</span><strong className={`condition-${tyreStatus}`}>{tyreStatus.toUpperCase()}</strong></div></div>
            <div className="wear-track"><span className={`wear-fill ${tyreStatus}`} style={{ width: `${race.tyreWear}%` }} /></div>
            <p className="micro-copy">Estimated degradation model · simulated data</p>
          </div>
          <div className="panel strategy-call">
            <div className="panel-title">STRATEGY CALL <span>LIVE</span></div>
            <div className="call-status"><span className={race.tyreWear > 72 ? 'status-amber' : 'status-green'} />{race.tyreWear > 72 ? 'PIT WINDOW OPEN' : 'HOLD POSITION'}</div>
            <p>{race.tyreWear > 72 ? 'Tyre degradation is approaching the limit. Prepare for a stop.' : 'Maintain current pace. Protect the rear tyres and monitor the gap.'}</p>
            <button className="outline-button" onClick={() => void sendMessage('What is the current pit strategy?')}>ASK ENGINEER <span>↗</span></button>
          </div>
          <div className="panel sim-controls">
            <div className="panel-title">RACE DIRECTOR <span>CONTROLS</span></div>
            <button onClick={() => updateRace(advanceLap)} className="control-button"><span>ADVANCE ONE LAP</span><b>＋</b></button>
            <button onClick={toggleWeather} className="control-button"><span>CYCLE WEATHER</span><b>↻</b></button>
            <button onClick={toggleSafetyCar} className="control-button"><span>{race.safetyCar ? 'END SAFETY CAR' : 'DEPLOY SAFETY CAR'}</span><b>⚑</b></button>
          </div>
        </aside>
      </section>

      <footer className="radio-dock">
        <div className="dock-label"><span className="dock-live" /> <div><strong>RADIO TRANSMIT</strong><small>{listening ? 'RECEIVING VOICE' : 'PUSH AND HOLD TO SPEAK'}</small></div></div>
        <button
          className={`ptt-button ${listening ? 'listening' : ''}`}
          onPointerDown={(event) => { event.preventDefault(); startListening() }}
          onPointerUp={stopListening}
          onPointerLeave={stopListening}
          onPointerCancel={stopListening}
          disabled={!recognitionSupported || busy}
          title={recognitionSupported ? 'Hold to speak' : 'Speech recognition is not supported in this browser'}
        >
          <span className="mic-symbol">●</span><strong>{listening ? 'LISTENING…' : 'HOLD TO TALK'}</strong><span className="ptt-key">PTT</span>
        </button>
        <div className="dock-shortcuts"><span>QUICK COMMS</span><button onClick={() => void sendMessage('Radio check')}>RADIO CHECK</button><button onClick={() => void sendMessage('Give me a race status update')}>STATUS</button><button onClick={() => void sendMessage('How are the tyres?')}>TYRES</button><button onClick={() => void sendMessage('What is the gap ahead and behind?')}>GAP</button></div>
      </footer>
      <div className="disclaimer">APEX RACE ENGINEERING <span>·</span> INDEPENDENT SIMULATION <span>·</span> ALL TELEMETRY IS ILLUSTRATIVE</div>
    </main>
  )
}
