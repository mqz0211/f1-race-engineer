export type RaceState = {
  lap: number
  totalLaps: number
  position: number
  gapAhead: number
  gapBehind: number
  tyreCompound: 'SOFT' | 'MEDIUM' | 'HARD'
  frontWear: number
  rearWear: number
  frontCondition: 'GOOD' | 'DEGRADING' | 'CRITICAL'
  rearCondition: 'GOOD' | 'DEGRADING' | 'CRITICAL'
  pitWindow: 'NOT YET' | 'OPEN'
  weather: 'DRY' | 'LIGHT RAIN' | 'WET'
  track: string
  driver: string
  team: string
  safetyCar: boolean
  pushMode: boolean
}

export type RadioMessage = {
  id: number
  from: 'engineer' | 'driver'
  text: string
  time: string
}

export const initialRaceState: RaceState = {
  lap: 12,
  totalLaps: 52,
  position: 8,
  gapAhead: 1.8,
  gapBehind: 2.6,
  tyreCompound: 'MEDIUM',
  frontWear: 64,
  rearWear: 42,
  frontCondition: 'DEGRADING',
  rearCondition: 'GOOD',
  pitWindow: 'NOT YET',
  weather: 'DRY',
  track: 'Silverstone',
  driver: 'CAR 07',
  team: 'APEX MOTORSPORT',
  safetyCar: false,
  pushMode: false,
}

export function isInformationRequest(raw: string): boolean {
  return /\b(what|where|when|which|how|report|tell me|status|temperature|temp|radio check|gap|information|explain)\b/i.test(raw)
}

export function advanceRaceState(raw: string, state: RaceState): RaceState {
  const q = raw.toLowerCase()
  const boxed = /\b(box|pit|pit stop|come in|bring it in)\b/.test(q)
  const pushing = /\b(push|attack|close the gap|catch p\d|overtake|faster)\b/.test(q)
  const managing = /\b(manage|look after|save|protect|take care|conserve)\b/.test(q)

  if (boxed) {
    return {
      ...state,
      lap: Math.min(state.totalLaps, state.lap + 1),
      tyreCompound: 'HARD',
      frontWear: 8,
      rearWear: 7,
      frontCondition: 'GOOD',
      rearCondition: 'GOOD',
      pitWindow: 'NOT YET',
      pushMode: false,
    }
  }

  const frontWear = Math.min(100, state.frontWear + (pushing ? 4 : managing ? 1 : 2))
  const rearWear = Math.min(100, state.rearWear + (pushing ? 3 : managing ? 1 : 1.5))
  return {
    ...state,
    lap: Math.min(state.totalLaps, state.lap + 1),
    frontWear,
    rearWear,
    frontCondition: frontWear >= 82 ? 'CRITICAL' : frontWear >= 55 ? 'DEGRADING' : 'GOOD',
    rearCondition: rearWear >= 82 ? 'CRITICAL' : rearWear >= 55 ? 'DEGRADING' : 'GOOD',
    gapAhead: Math.max(0.7, Number((state.gapAhead + (pushing ? -0.2 : managing ? 0.05 : 0.1)).toFixed(1))),
    gapBehind: Math.max(0.6, Number((state.gapBehind + (pushing ? 0.15 : -0.05)).toFixed(1))),
    pitWindow: frontWear >= 76 ? 'OPEN' : state.pitWindow,
    pushMode: pushing,
  }
}

export function generateDriverReply(raw: string, state: RaceState): string {
  const q = raw.toLowerCase()
  const front = state.frontCondition.toLowerCase()
  const compound = state.tyreCompound.toLowerCase()

  if (/\b(temperature|temp|front[- ]left|which tyre|where.*slide|more information|more info|tell me more|details)\b/.test(q)) {
    return 'Front-left is taking the most load. The sliding starts on entry to Maggotts and carries into Becketts. Front-right is more stable, and rear traction still feels good.'
  }
  if (/\b(gap|position|status|where are we|race update)\b/.test(q)) {
    return `We're P${state.position}, lap ${state.lap} of ${state.totalLaps. The car ahead is ${state.gapAhead.toFixed(1)} seconds up the road, and the car behind is ${state.gapBehind.toFixed(1)} back. Front tyres are ${front}; rears are ${state.rearCondition.toLowerCase()}.`
  }
  if (/\b(box|pit|pit stop|come in|bring it in)\b/.test(q)) {
    return state.pitWindow === 'OPEN'
      ? 'Copy, box this lap. I will bring it in cleanly and take the hard tyres. The fronts have had enough.'
      : 'Copy, box this lap. I will bring it in at the end of the lap. Confirming we are going to the hard tyre?'
  }
  if (/\b(manage|look after|save|protect|take care|conserve)\b/.test(q)) {
    return 'Understood. I will be kinder to the fronts, especially on turn-in through Maggotts and Becketts. I will keep the car tidy and report back if the balance gets worse.'
  }
  if (/\b(push|attack|close the gap|catch p\d|overtake|faster)\b/.test(q)) {
    return state.frontWear >= 72
      ? 'Copy. I can push, but the front is already moving around. I will pick the moment on the Hangar Straight and avoid overworking the tyres through the fast section.'
      : `Copy. I will push for P${state.position - 1}. Gap is coming down; I will use the straight and keep the exits clean.`
  }
  if (/\b(hold|maintain|defend|position)\b/.test(q)) {
    return 'Copy. I will defend P' + state.position + ' and keep the car between the lines. I will manage the front tyres while keeping an eye on the car behind.'
  }
  if (/\b(rain|weather|wet|track condition)\b/.test(q)) {
    return `Track is still ${state.weather.toLowerCase()}. Grip is consistent at the moment; no rain is affecting the racing line.`
  }
  if (/\b(safety car|sc|vsc)\b/.test(q)) {
    return state.safetyCar
      ? 'Copy. I am keeping to the Safety Car delta and looking after the tyre temperatures.'
      : 'Understood. We are still green out here; no Safety Car or VSC at the moment.'
  }

  return 'Copy. Just to make sure I have understood: would you like me to manage the tyres, push for the car ahead, or box for a new set?'
}

export function makeMessage(from: RadioMessage['from'], text: string): RadioMessage {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    from,
    text,
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}
