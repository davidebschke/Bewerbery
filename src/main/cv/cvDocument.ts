import { unzipSync, zipSync, type Unzipped, type Zippable } from 'fflate'
import { MAX_CV_CHARS, MAX_CV_FILE_BYTES, MAX_CV_PARAGRAPHS } from '@shared/constants'
import { fail, ok, type AiErrorCode, type AiResult } from '@shared/domain/cv/aiErrors'
import { parseDocxParagraphs } from '@shared/domain/cv/document/docx'
import { parseOdtParagraphs } from '@shared/domain/cv/document/odt'
import { rewriteXml, type Rewrites } from '@shared/domain/cv/document/rewriteXml'
import type { ParsedDocument } from '@shared/domain/cv/document/types'
import type { CvFormat, CvSource } from '@shared/domain/cv/schemas'
import { tokenizeXml } from '@shared/xml/tokens'

export const CV_EXTENSIONS = ['docx', 'odt'] as const

/** Filterbeschriftungen für Speichern-Dialoge */
export const CV_FORMAT_LABELS: Record<CvFormat, string> = {
  docx: 'Word-Dokument (DOCX)',
  odt: 'LibreOffice-Dokument (ODT)',
}

const DEFAULT_DOCX_MAIN = 'word/document.xml'
const ODT_MAIN = 'content.xml'
const OFFICE_DOCUMENT_REL = /\/officeDocument$/

export interface LoadedCvDocument {
  source: CvSource
  parsed: ParsedDocument
  /** Name des bearbeiteten XML-Teils im ZIP */
  mainEntry: string
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value)
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] // PK..

function extensionOf(fileName: string): string {
  const match = /\.([^.\\/]+)$/.exec(fileName)
  return match ? match[1].toLowerCase() : ''
}

const decoder = new TextDecoder('utf-8')
const encoder = new TextEncoder()

/** Ermittelt den Hauptteil einer DOCX über `_rels/.rels` (meist `word/document.xml`) */
function docxMainEntry(files: Unzipped): string {
  const rels = files['_rels/.rels']
  if (!rels) return DEFAULT_DOCX_MAIN
  for (const token of tokenizeXml(decoder.decode(rels))) {
    if (token.kind !== 'open' || !token.name.endsWith('Relationship')) continue
    const { Type: type, Target: target } = token.attributes
    if (type && target && OFFICE_DOCUMENT_REL.test(type)) return target.replace(/^\//, '')
  }
  return DEFAULT_DOCX_MAIN
}

function unzip(bytes: Uint8Array): Unzipped | null {
  try {
    return unzipSync(bytes)
  } catch {
    return null
  }
}

/** Prüft den Dateinamen vor dem Lesen: PDF bzw. nicht unterstützte Formate */
export function checkCvFileName(fileName: string): AiErrorCode | null {
  const extension = extensionOf(fileName)
  if (extension === 'pdf') return 'pdf-not-supported'
  if (!(CV_EXTENSIONS as readonly string[]).includes(extension)) return 'unsupported-file'
  return null
}

/**
 * Liest einen Lebenslauf (DOCX/ODT) ein und zerlegt ihn in Absätze und Segmente.
 * PDF und andere Formate werden mit passendem Fehlercode abgelehnt.
 */
export function readCvDocument(bytes: Uint8Array, fileName: string): AiResult<LoadedCvDocument> {
  const extension = extensionOf(fileName)
  if (startsWith(bytes, PDF_SIGNATURE)) return fail('pdf-not-supported')
  const nameError = checkCvFileName(fileName)
  if (nameError) return fail(nameError)
  if (bytes.length > MAX_CV_FILE_BYTES) return fail('file-too-large')
  // Passwortgeschützte DOCX sind OLE-Container statt ZIP
  if (!startsWith(bytes, ZIP_SIGNATURE)) return fail('unreadable-file')

  const files = unzip(bytes)
  if (!files) return fail('unreadable-file')

  const format = extension as CvFormat
  const mainEntry = format === 'docx' ? docxMainEntry(files) : ODT_MAIN
  const main = files[mainEntry]
  if (!main) return fail('unreadable-file')

  const xml = decoder.decode(main)
  const parsed = format === 'docx' ? parseDocxParagraphs(xml) : parseOdtParagraphs(xml)
  if (parsed.hasTrackedChanges) return fail('tracked-changes')
  if (!parsed.paragraphs.some((paragraph) => paragraph.editable)) return fail('no-text')

  const charCount = parsed.paragraphs.reduce(
    (sum, paragraph) => sum + paragraph.segments.join('').length,
    0,
  )
  if (parsed.paragraphs.length > MAX_CV_PARAGRAPHS || charCount > MAX_CV_CHARS) {
    return fail('too-long')
  }

  return ok({
    source: { format, fileName, paragraphs: parsed.paragraphs, charCount },
    parsed,
    mainEntry,
  })
}

/**
 * Schreibt die Ersetzungen in eine Kopie der Originaldatei. Nur der Haupt-XML-Teil ändert
 * sich; alle anderen Einträge (Styles, Bilder, Kopf-/Fußzeilen …) werden unverändert übernommen.
 */
export function writeCvDocument(
  bytes: Uint8Array,
  loaded: LoadedCvDocument,
  rewrites: Rewrites,
): Uint8Array {
  const files = unzipSync(bytes)
  const xml = decoder.decode(files[loaded.mainEntry])
  const rewritten = rewriteXml(xml, loaded.parsed, rewrites, loaded.source.format)

  const output: Zippable = {}
  // ODT: `mimetype` muss der erste, unkomprimierte Eintrag bleiben
  if (files.mimetype) output.mimetype = [files.mimetype, { level: 0 }]
  for (const [name, content] of Object.entries(files)) {
    if (name === 'mimetype') continue
    output[name] = name === loaded.mainEntry ? encoder.encode(rewritten) : content
  }
  return zipSync(output)
}
