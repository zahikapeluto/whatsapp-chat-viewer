import JSZip from 'jszip'
import { getChatTitle, parseChatExport, type ChatMessage } from './chat'

export interface ImportedChat {
  messages: ChatMessage[]
  title: string
  textFileName: string
  mediaUrls: Record<string, string>
}

const MAX_ZIP_BYTES = 2 * 1024 * 1024 * 1024
const MAX_TEXT_BYTES = 100 * 1024 * 1024

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  '3gp': 'video/3gpp',
  webm: 'video/webm',
  opus: 'audio/ogg',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  pdf: 'application/pdf',
}

export async function importChatZip(file: File): Promise<ImportedChat> {
  if (file.size > MAX_ZIP_BYTES) {
    throw new Error('This ZIP file is too large to open in the browser.')
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error('This file is not a valid ZIP archive.')
  }

  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && !entry.name.startsWith('__MACOSX/'),
  )
  const textEntry =
    entries.find((entry) => /(^|\/)_chat\.txt$/i.test(entry.name)) ??
    entries.find((entry) => /\.txt$/i.test(entry.name))

  if (!textEntry) {
    throw new Error('No chat text file was found inside this ZIP.')
  }

  const text = await textEntry.async('string')
  if (text.length > MAX_TEXT_BYTES) {
    throw new Error('The chat text file is too large to display.')
  }

  const messages = parseChatExport(text)
  if (messages.length === 0) {
    throw new Error('No WhatsApp messages could be read from this chat file.')
  }

  const referenced = new Set(
    messages.map((message) => message.mediaName?.toLowerCase()).filter(Boolean) as string[],
  )

  const mediaUrls: Record<string, string> = {}
  for (const entry of entries) {
    if (entry === textEntry) continue
    const baseName = entry.name.replace(/^.*\//, '')
    const key = baseName.toLowerCase()
    if (!referenced.has(key)) continue
    const extension = key.split('.').pop() ?? ''
    const data = await entry.async('uint8array')
    const blob = new Blob([data as BlobPart], {
      type: MIME_TYPES[extension] ?? 'application/octet-stream',
    })
    mediaUrls[key] = URL.createObjectURL(blob)
  }

  return {
    messages,
    title: getChatTitle(textEntry.name) || getChatTitle(file.name.replace(/\.zip$/i, '.txt')),
    textFileName: textEntry.name,
    mediaUrls,
  }
}
