export type MediaType = 'image' | 'video' | 'audio' | 'document'

export interface ChatMessage {
  id: number
  dateKey: string
  dateLabel: string
  timeLabel: string
  timestamp: Date | null
  sender: string
  body: string
  system: boolean
  mediaName?: string
  mediaType?: MediaType
}

// Android: "12/31/24, 9:14 PM - Name: text"  /  iOS: "[12/31/24, 9:14:05 PM] Name: text"
const LINE_PATTERNS = [
  /^[\u200e\u200f]*\[?(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s?[APap]\.?[Mm]\.?)?)\]?\s+(?:-\s+)?(.*)$/,
]

const ATTACHED =
  /<(?:attached|מצורף):\s*([^>]+)>|[\u200e\u200f]*([^\s<>:]+\.[A-Za-z0-9]{2,5})\s+\((?:file attached|הקובץ מצורף|קובץ מצורף|arquivo anexado|Datei angehängt)\)/i

const MEDIA_TYPES: Record<string, MediaType> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  heic: 'image',
  mp4: 'video',
  mov: 'video',
  '3gp': 'video',
  webm: 'video',
  opus: 'audio',
  ogg: 'audio',
  mp3: 'audio',
  m4a: 'audio',
  aac: 'audio',
  wav: 'audio',
}

export function getMediaType(fileName: string): MediaType {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  return MEDIA_TYPES[extension] ?? 'document'
}

function parseDate(dateText: string, timeText: string): Date | null {
  const parts = dateText.split(/[./-]/).map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null

  const [first, second, third] = parts
  let year: number
  let month: number
  let day: number

  if (first > 31) {
    ;[year, month, day] = [first, second, third]
  } else {
    year = third < 100 ? 2000 + third : third
    // Day-first (DD.MM.YYYY) unless the second number can only be a day.
    if (second > 12) {
      ;[month, day] = [first, second]
    } else {
      ;[day, month] = [first, second]
    }
  }

  const time = timeText.trim().match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s?([APap])?/)
  if (!time) return null
  let hours = Number(time[1])
  const minutes = Number(time[2])
  const seconds = Number(time[3] ?? 0)
  const meridiem = time[4]?.toLowerCase()
  if (meridiem === 'p' && hours < 12) hours += 12
  if (meridiem === 'a' && hours === 12) hours = 0

  const date = new Date(year, month - 1, day, hours, minutes, seconds)
  return Number.isNaN(date.getTime()) ? null : date
}

export function parseChatExport(text: string): ChatMessage[] {
  const messages: ChatMessage[] = []
  let current: ChatMessage | null = null

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[\u200e\u200f]+/, '')
    let match: RegExpMatchArray | null = null
    for (const pattern of LINE_PATTERNS) {
      match = line.match(pattern)
      if (match) break
    }

    if (!match) {
      if (current && line.length > 0) current.body += `\n${line}`
      else if (current && rawLine === '') current.body += '\n'
      continue
    }

    const [, dateText, timeText, rest] = match
    const separator = rest.indexOf(': ')
    const sender = separator > 0 ? rest.slice(0, separator) : ''
    const body = separator > 0 ? rest.slice(separator + 2) : rest

    const timestamp = parseDate(dateText, timeText)
    current = {
      id: messages.length,
      dateKey: timestamp
        ? `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}`
        : dateText,
      dateLabel: dateText,
      timeLabel: timeText,
      timestamp,
      sender,
      body,
      system: separator <= 0,
    }
    messages.push(current)
  }

  for (const message of messages) {
    message.body = message.body.replace(/\n+$/, '')
    const attached = message.body.match(ATTACHED)
    const mediaName = (attached?.[1] ?? attached?.[2])?.trim()
    if (mediaName) {
      message.mediaName = mediaName
      message.mediaType = getMediaType(mediaName)
      message.body = message.body.replace(ATTACHED, '').trim()
    }
  }

  return messages
}

export function getChatTitle(fileName: string): string {
  return fileName
    .replace(/^.*\//, '')
    .replace(/\.txt$/i, '')
    .replace(/^WhatsApp Chat (with|-)\s*/i, '')
    .trim()
}

export function getMessageTime(timeLabel: string): string {
  const match = timeLabel.trim().match(/^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s?([APap])?\.?[Mm]?\.?/)
  if (!match) return timeLabel
  const [, hours, minutes, meridiem] = match
  return meridiem
    ? `${hours}:${minutes} ${meridiem.toUpperCase()}M`
    : `${hours.padStart(2, '0')}:${minutes}`
}

export function getDayLabel(timestamp: Date | null, fallback: string): string {
  if (!timestamp) return fallback
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const days = Math.round((startOfDay(new Date()) - startOfDay(timestamp)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return timestamp.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
