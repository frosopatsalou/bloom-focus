let context
let ambientNodes = []

function audioContext() {
  context ||= new (window.AudioContext || window.webkitAudioContext)()
  return context
}

export async function playAmbient(kind = 'rain', volume = 0.25) {
  stopAmbient()
  const ctx = audioContext()
  await ctx.resume()
  const length = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let brown = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    brown = (brown + 0.02 * white) / 1.02
    data[i] = kind === 'rain' ? white * 0.26 : kind === 'forest' ? (white * 0.05 + Math.sin(i / 430) * 0.025) : brown * 2.8
  }
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  source.buffer = buffer
  source.loop = true
  filter.type = kind === 'rain' ? 'highpass' : 'lowpass'
  filter.frequency.value = kind === 'rain' ? 700 : 800
  gain.gain.value = Number(volume)
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start()
  ambientNodes = [source, filter, gain]
}

export function stopAmbient() {
  ambientNodes[0]?.stop?.()
  ambientNodes.forEach(node => node.disconnect?.())
  ambientNodes = []
}

export async function completionChime() {
  const ctx = audioContext()
  await ctx.resume()
  ;[523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.frequency.value = frequency
    oscillator.type = 'sine'
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + index * 0.12)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + index * 0.12 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.12 + 0.45)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(ctx.currentTime + index * 0.12)
    oscillator.stop(ctx.currentTime + index * 0.12 + 0.5)
  })
}
