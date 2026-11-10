export type RaceState = {
  lap: number
  totalLaps: number
  position: number
  gapAhead: number
  gapBehind: number
  tyreCompound: 'SOFT' | 'MEDIUM' | 'HARD'
  tyreWear: number
  fuelDelta: number
  trackTemp: number
  airTemp: number
  weather: 'DRY' | 'LIGHT RAIN' | 'WET'
  track: string
  driver: string
  team: string
  safetyCar: boolean
  pushMode: boolean
}

export type RadioMessage = {
  id: number
  from: 'driver' | 'engineer'
  text: string
  time: string
}

export const initialRaceState: RaceState = {
  lap: 18,
  totalLaps: 52,
  position: 7,
  gapAhead: 2.4,
  gapBehind: 1.1,
  tyreCompound: 'MEDIUM',
  tyreWear: 42,
  fuelDelta: 0.8,
  trackTemp: 34,
  airTemp: 21,
  weather: 'DRY',
  track: 'Silverstone',
  driver: 'CAR 07',
  team: 'APEX MOTORSPORT',
  safetyCar: false,
  pushMode: false,
}

export function advanceLap(state: RaceState): RaceState {
  if (state.lap >= state.totalLaps) return state
  return {
    ...state,
    lap: state.lap + 1,
    tyreWear: Math.min(100, state.tyreWear + (state.pushMode ? 1.7 : 1.15)),
    fuelDelta: Number((state.fuelDelta - 0.12).toFixed(1)),
    gapAhead: Math.max(0.7, Number((state.gapAhead + (Math.random() - 0.52) * 0.22).toFixed(1))),
    gapBehind: Math.max(0.6, Number((state.gapBehind + (Math.random() - 0.48) * 0.2).toFixed(1))),
  }
}

export function generateEngineerReply(raw: string, state: RaceState): string {
  const q = raw.toLowerCase()
  const tyre = `${state.tyreCompound.toLowerCase()} tyres`

  if (/\b(hello|radio check|check radio|test)\b/.test(q)) {
    return 'Loud and clear. Radio check good. We are on lap ' + state.lap + ', position P' + state.position + '.'
  }
  if (/\b(status|where am i|position|race update|how are we)\b/.test(q)) {
    return `P${state.position}, lap ${state.lap} of ${state.totalLaps}. Gap ahead ${state.gapAhead.toFixed(1)}, behind ${state.gapBehind.toFixed(1)}. Tyres are ${tyre} at ${state.tyreWear}% estimated wear. Fuel is ${state.fuelDelta >= 0 ? '+' : ''}${state.fuelDelta.toFixed(1)} laps. ${state.weather === 'DRY' ? 'Track is dry.' : state.weather + ' conditions.'}`
  }
  if (/\b(tyre|tire|wear|compound|grip)\b/.test(q)) {
    const advice = state.tyreWear > 75
      ? 'We are approaching the end of the tyre window. Let us protect the rears and prepare the pit stop.'
      : state.tyreWear > 55
        ? 'Manage the rear traction on exit. We are monitoring the degradation.'
        : 'Tyre life is in a reasonable window. Keep the entries tidy and look after the traction zones.'
    return `${state.tyreCompound} compound, estimated wear ${state.tyreWear}%. ${advice}`
  }
  if (/\b(box|pit|pit stop|come in)\b/.test(q)) {
    if (state.safetyCar) return 'Safety Car is deployed. This is a strong window to box if the tyre life and remaining distance work for us. Confirm and we will commit.'
    if (state.tyreWear >= 72) return 'Copy. Tyre wear is high. Box this lap for a fresh set; pit entry is clear in the simulation.'
    return `Copy the pit request. Current wear is ${state.tyreWear}%. Our preferred call is to stay out for now and protect the current stint. I will reassess next lap.`
  }
  if (/\b(gap|behind|ahead|leader|traffic|car in front)\b/.test(q)) {
    return `You are P${state.position}. The car ahead is ${state.gapAhead.toFixed(1)} seconds up the road; the car behind is ${state.gapBehind.toFixed(1)} seconds back. Prioritise a clean exit through the final sector.`
  }
  if (/\b(weather|rain|temperature|track temp)\b/.test(q)) {
    return `Track temperature is ${state.trackTemp} degrees, air temperature ${state.airTemp}. Conditions are ${state.weather.toLowerCase()}. We do not have rain affecting the racing line at the moment.`
  }
  if (/\b(fuel|lift|coast|energy)\b/.test(q)) {
    const fuelMessage = state.fuelDelta >= 0
      ? `We have ${state.fuelDelta.toFixed(1)} laps of fuel margin. No lift-and-coast required at this stage.`
      : `We are ${Math.abs(state.fuelDelta).toFixed(1)} laps short on the current estimate. Start measured lift-and-coast at the end of the longest straights.`
    return fuelMessage
  }
  if (/\b(push|pace|attack|faster|overtake)\b/.test(q)) {
    return state.tyreWear > 68
      ? 'You can push for one lap, but keep the rear temperatures under control. We need to avoid taking too much life out of this set.'
      : 'Understood. Push mode for the next lap. Use the battery on the main straight and commit to the exit of the final corner.'
  }
  if (/\b(safety car|sc|vsc)\b/.test(q)) {
    return state.safetyCar
      ? 'Safety Car is active. Delta is positive; keep within the required pace and maintain tyre temperature.'
      : 'No Safety Car or Virtual Safety Car in this simulation. We are green.'
  }
  return 'Copy. We are monitoring that. Keep the car balanced and give me the detail again if the situation changes.'
}

export function makeMessage(from: RadioMessage['from'], text: string): RadioMessage {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    from,
    text,
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}
