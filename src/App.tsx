import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  BatteryFull,
  CheckCheck,
  LockKeyhole,
  MoreVertical,
  Phone,
  Signal,
  Upload,
  Video,
  Wifi,
} from 'lucide-react'
import {
  getDayLabel,
  getMessageTime,
  parseChatExport,
  type ChatMessage,
} from './chat'
import { importChatZip } from './importChat'
import './App.css'

const OWNER_NAMES = ['טל', 'tal']
const SAMPLE_TITLE = 'Maya Chen'
const sampleMessages = parseChatExport(`
11.12.2024, 9:14 - Maya Chen: Made it to the coast. The light is unreal today.
11.12.2024, 9:16 - You: That sky looks like it was edited.
11.12.2024, 9:16 - You: Save me a seat by the window
11.12.2024, 9:22 - Maya Chen: Already on it. Train gets in at 10:05, right?
11.12.2024, 9:23 - You: Exactly. See you soon!
`)

// Matches the owner as a full name or first name; "You" covers the sample chat.
function isOwn(sender: string) {
  const name = sender.trim().toLowerCase()
  return (
    /^(you|me)$/.test(name) ||
    OWNER_NAMES.some((owner) => name === owner || name.startsWith(`${owner} `))
  )
}

// One-to-one chats are titled by the other person; groups keep the file-based name.
function getTitle(messages: ChatMessage[], fallback: string) {
  const others = new Set(
    messages.filter((m) => !m.system && !isOwn(m.sender)).map((m) => m.sender),
  )
  return others.size === 1 ? [...others][0] : fallback || 'WhatsApp chat'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const urlsRef = useRef<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>(sampleMessages)
  const [title, setTitle] = useState(SAMPLE_TITLE)
  const [isSample, setIsSample] = useState(true)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages])

  useEffect(() => () => urlsRef.current.forEach((url) => URL.revokeObjectURL(url)), [])

  async function handleFile(file?: File) {
    if (!file) return
    setError('')
    setIsLoading(true)
    try {
      const imported = await importChatZip(file)
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      urlsRef.current = Object.values(imported.mediaUrls)
      setMessages(imported.messages)
      setMediaUrls(imported.mediaUrls)
      setTitle(getTitle(imported.messages, imported.title))
      setIsSample(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open this ZIP file.')
    } finally {
      setIsLoading(false)
    }
  }

  const senders = [...new Set(messages.filter((m) => !m.system).map((m) => m.sender))]
  const isGroup = senders.length > 2

  return (
    <main className="stage">
      <button
        className="import-button"
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
      >
        <Upload size={16} aria-hidden="true" />
        {isLoading ? 'Opening…' : 'Open chat ZIP'}
      </button>
      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        accept=".zip,application/zip"
        aria-label="Choose a WhatsApp chat export ZIP"
        onChange={(event) => {
          void handleFile(event.currentTarget.files?.[0])
          event.currentTarget.value = ''
        }}
      />

      <section className="phone" aria-label="WhatsApp chat">
        <div className="screen">
          <div className="status-bar">
            <span>9:41</span>
            <span className="punch-hole" aria-hidden="true" />
            <span className="status-icons" aria-hidden="true">
              <Wifi size={14} />
              <Signal size={14} />
              <BatteryFull size={18} />
            </span>
          </div>

          <div className="chat-header">
            <ArrowLeft size={22} aria-hidden="true" />
            <div className="avatar" aria-hidden="true">
              {initials(title)}
            </div>
            <div className="contact">
              <div className="contact-name">{title}</div>
              <div className="contact-status">
                {isSample ? 'online' : `${messages.length.toLocaleString()} messages`}
              </div>
            </div>
            <Video size={21} aria-hidden="true" />
            <Phone size={19} aria-hidden="true" />
            <MoreVertical size={20} aria-hidden="true" />
          </div>

          <div className="messages" ref={scrollRef}>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div className="notice">
              <LockKeyhole size={11} aria-hidden="true" />
              Exported chat. Read only.
            </div>

            {messages.map((message, index) => {
              const previous = messages[index - 1]
              const newDay = !previous || previous.dateKey !== message.dateKey
              const own = isOwn(message.sender)
              const grouped =
                previous &&
                !newDay &&
                !previous.system &&
                previous.sender === message.sender
              const mediaUrl = message.mediaName
                ? mediaUrls[message.mediaName.toLowerCase()]
                : undefined

              return (
                <div key={message.id}>
                  {newDay && (
                    <div className="day">
                      <span>{getDayLabel(message.timestamp, message.dateLabel)}</span>
                    </div>
                  )}
                  {message.system ? (
                    <div className="system">
                      <span>{message.body}</span>
                    </div>
                  ) : (
                    <div className={`row ${own ? 'out' : 'in'} ${grouped ? 'grouped' : ''}`}>
                      <article className="bubble" dir="auto">
                        {isGroup && !own && !grouped && (
                          <div className="author">{message.sender}</div>
                        )}
                        {mediaUrl && message.mediaType === 'image' && (
                          <img className="media" src={mediaUrl} alt="Shared" />
                        )}
                        {mediaUrl && message.mediaType === 'video' && (
                          <video className="media" src={mediaUrl} controls />
                        )}
                        {mediaUrl && message.mediaType === 'audio' && (
                          <audio className="audio" src={mediaUrl} controls />
                        )}
                        {mediaUrl && message.mediaType === 'document' && (
                          <a className="doc" href={mediaUrl} download={message.mediaName}>
                            {message.mediaName}
                          </a>
                        )}
                        {message.mediaName && !mediaUrl && (
                          <div className="missing">Media not included in export</div>
                        )}
                        {message.body && <span className="text">{message.body}</span>}
                        <span className="meta">
                          {getMessageTime(message.timeLabel)}
                          {own && <CheckCheck size={15} aria-label="Delivered" />}
                        </span>
                      </article>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="gesture" aria-hidden="true">
            <span />
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
