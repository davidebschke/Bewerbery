/**
 * Erzeugt Beispiel-Lebensläufe (Softwareentwicklung / AI-Engineering) und passende
 * Stellenanzeigen unter tests/fixtures/cv/samples/ – zum manuellen Testen der
 * CV-Optimierung und als Testdaten für den DOCX/ODT-Parser.
 *
 * Jeder Lebenslauf entsteht als flache OpenDocument-Datei (.fodt), die LibreOffice
 * headless in echte .docx/.odt (und einmal .pdf) umwandelt – so testen wir gegen Dateien,
 * wie sie ein Office-Programm wirklich speichert (Formatvorlagen, Tabellen, Textrahmen,
 * Bilder, Kopf-/Fußzeilen).
 *
 * Alle Personen, Firmen und Kontaktdaten sind frei erfunden.
 *
 * Aufruf: node scripts/generate-cv-samples.mjs
 * LibreOffice-Pfad bei Bedarf über SOFFICE=<Pfad zu soffice> setzen.
 * KEEP_WORK=1 behält den Arbeitsordner mit den .fodt-Quellen (zur Fehlersuche).
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

const OUT = join(import.meta.dirname, '../tests/fixtures/cv/samples')
const SOFFICE =
  process.env.SOFFICE ??
  ['C:/Program Files/LibreOffice/program/soffice.exe', '/usr/bin/soffice'].find(existsSync) ??
  'soffice'

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const esc = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Einfaches PNG (Platzhalter-Foto): Hintergrund mit heller „Silhouette“ */
function placeholderPng(width = 120, height = 144) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc32 = (bytes) => {
    let c = 0xffffffff
    for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const out = Buffer.alloc(12 + data.length)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), 8 + data.length)
    return out
  }
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const head = (x - width / 2) ** 2 + (y - height * 0.38) ** 2 < (width * 0.22) ** 2
      const body =
        (x - width / 2) ** 2 / (width * 0.42) ** 2 + (y - height) ** 2 / (height * 0.4) ** 2 < 1
      const [r, g, b] = head || body ? [214, 222, 235] : [96, 118, 150]
      const i = y * (width * 3 + 1) + 1 + x * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64')
}

// ---------------------------------------------------------------------------
// Bausteine (OpenDocument-Text)
// ---------------------------------------------------------------------------

const p = (style, content) => `<text:p text:style-name="${style}">${content}</text:p>`
/** Absatz mit reinem Text (wird escaped) */
const t = (style, text) => p(style, esc(text))
const span = (style, text) => `<text:span text:style-name="${style}">${esc(text)}</text:span>`
const link = (href, text) =>
  `<text:a xlink:type="simple" xlink:href="${esc(href)}">${esc(text)}</text:a>`
const heading = (text) => p('CV_Heading', esc(text))
const labelLine = (label, value, style = 'CV_Body') =>
  p(style, `${span('CV_Label', `${label}: `)}${esc(value)}`)
const bullets = (items) =>
  `<text:list text:style-name="CV_List">${items
    .map((item) => `<text:list-item>${p('CV_Bullet', esc(item))}</text:list-item>`)
    .join('')}</text:list>`

/** Station: Zeitraum ⇥ Position (fett) · Firma, darunter Aufzählung */
function entry({ period, title, org, items = [] }) {
  return (
    p(
      'CV_Entry',
      `${esc(period)}<text:tab/>${span('CV_Label', title)}${org ? ` · ${span('CV_Accent', org)}` : ''}`,
    ) + (items.length ? bullets(items) : '')
  )
}

const photo = () =>
  p(
    'CV_Center',
    `<draw:frame draw:style-name="frPhoto" draw:name="Foto" text:anchor-type="as-char" svg:width="3.2cm" svg:height="3.84cm" draw:z-index="1"><draw:image><office:binary-data>${placeholderPng()}</office:binary-data></draw:image></draw:frame>`,
  )

/** Textrahmen rechts neben dem Namen (wird in DOCX zu einem Textfeld) */
const contactFrame = (lines) =>
  `<draw:frame draw:style-name="frContact" draw:name="Kontakt" text:anchor-type="paragraph" svg:x="11.2cm" svg:y="0cm" svg:width="6.2cm" draw:z-index="0"><draw:text-box fo:min-height="2.6cm">${lines.join('')}</draw:text-box></draw:frame>`

// ---------------------------------------------------------------------------
// Dokument-Gerüst
// ---------------------------------------------------------------------------

function document({
  lang = 'de',
  country = 'DE',
  accent = '#1f3a5f',
  header,
  footer,
  trackedChanges = '',
  body,
}) {
  const headerXml = header ? `<style:header>${p('CV_Muted', esc(header))}</style:header>` : ''
  const footerXml = footer
    ? `<style:footer>${p('CV_Muted', `${esc(footer)} <text:page-number text:select-page="current">1</text:page-number>`)}</style:footer>`
    : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text">
<office:font-face-decls>
 <style:font-face style:name="Calibri" svg:font-family="Calibri" style:font-family-generic="swiss"/>
 <style:font-face style:name="Calibri Light" svg:font-family="'Calibri Light'" style:font-family-generic="swiss"/>
</office:font-face-decls>
<office:styles>
 <style:default-style style:family="paragraph">
  <style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0.08cm" fo:line-height="115%"/>
  <style:text-properties style:font-name="Calibri" fo:font-size="10.5pt" fo:color="#222222" fo:language="${lang}" fo:country="${country}"/>
 </style:default-style>
 <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
 <style:style style:name="CV_Name" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties fo:margin-bottom="0cm"/>
  <style:text-properties style:font-name="Calibri Light" fo:font-size="26pt" fo:color="${accent}" fo:letter-spacing="0.02cm"/>
 </style:style>
 <style:style style:name="CV_Role" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties fo:margin-bottom="0.35cm"/>
  <style:text-properties fo:font-size="13pt" fo:color="#5b6b80" fo:font-weight="bold"/>
 </style:style>
 <style:style style:name="CV_Heading" style:family="paragraph" style:parent-style-name="Standard" style:default-outline-level="2">
  <style:paragraph-properties fo:margin-top="0.35cm" fo:margin-bottom="0.15cm" fo:padding-bottom="0.05cm" fo:border-bottom="1.1pt solid ${accent}" fo:keep-with-next="always"/>
  <style:text-properties fo:font-size="11.5pt" fo:font-weight="bold" fo:color="${accent}" fo:text-transform="uppercase" fo:letter-spacing="0.03cm"/>
 </style:style>
 <style:style style:name="CV_Body" style:family="paragraph" style:parent-style-name="Standard"/>
 <style:style style:name="CV_Center" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.25cm"/>
 </style:style>
 <style:style style:name="CV_Entry" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties fo:margin-top="0.12cm" fo:margin-left="3.2cm" fo:text-indent="-3.2cm">
   <style:tab-stops><style:tab-stop style:position="0cm"/></style:tab-stops>
  </style:paragraph-properties>
 </style:style>
 <style:style style:name="CV_Bullet" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties fo:margin-left="3.2cm" fo:margin-bottom="0.04cm"/>
 </style:style>
 <style:style style:name="CV_Sidebar" style:family="paragraph" style:parent-style-name="Standard">
  <style:text-properties fo:font-size="9.5pt"/>
 </style:style>
 <style:style style:name="CV_SidebarHeading" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties fo:margin-top="0.3cm" fo:margin-bottom="0.1cm"/>
  <style:text-properties fo:font-size="10pt" fo:font-weight="bold" fo:color="${accent}" fo:text-transform="uppercase"/>
 </style:style>
 <style:style style:name="CV_Muted" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties fo:text-align="end"/>
  <style:text-properties fo:font-size="8.5pt" fo:color="#7a8699"/>
 </style:style>
 <style:style style:name="CV_Label" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
 <style:style style:name="CV_Accent" style:family="text"><style:text-properties fo:color="${accent}" fo:font-style="italic"/></style:style>
 <text:list-style style:name="CV_List">
  <text:list-level-style-bullet text:level="1" text:bullet-char="•">
   <style:list-level-properties text:list-level-position-and-space-mode="label-alignment">
    <style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="3.65cm" fo:text-indent="-0.4cm" fo:margin-left="3.65cm"/>
   </style:list-level-properties>
  </text:list-level-style-bullet>
 </text:list-style>
</office:styles>
<office:automatic-styles>
 <style:style style:name="Layout" style:family="table"><style:table-properties style:width="17.4cm" table:align="margins"/></style:style>
 <style:style style:name="Layout.A" style:family="table-column"><style:table-column-properties style:column-width="5.4cm"/></style:style>
 <style:style style:name="Layout.B" style:family="table-column"><style:table-column-properties style:column-width="12cm"/></style:style>
 <style:style style:name="Layout.A1" style:family="table-cell"><style:table-cell-properties fo:background-color="#eef2f7" fo:padding="0.35cm" fo:border="none" style:vertical-align="top"/></style:style>
 <style:style style:name="Layout.B1" style:family="table-cell"><style:table-cell-properties fo:padding-left="0.5cm" fo:padding-top="0.1cm" fo:border="none" style:vertical-align="top"/></style:style>
 <style:style style:name="frContact" style:family="graphic"><style:graphic-properties fo:background-color="#eef2f7" fo:padding="0.25cm" fo:border="0.75pt solid ${accent}" style:wrap="parallel" style:number-wrapped-paragraphs="no-limit" style:vertical-pos="from-top" style:vertical-rel="paragraph" style:horizontal-pos="from-left" style:horizontal-rel="paragraph"/></style:style>
 <style:style style:name="frPhoto" style:family="graphic"><style:graphic-properties fo:border="2pt solid #ffffff" style:vertical-pos="top" style:vertical-rel="baseline"/></style:style>
 <style:page-layout style:name="pm1">
  <style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="1.4cm" fo:margin-bottom="1.4cm" fo:margin-left="1.8cm" fo:margin-right="1.8cm"/>
  <style:header-style><style:header-footer-properties fo:min-height="0.5cm" fo:margin-bottom="0.3cm"/></style:header-style>
  <style:footer-style><style:header-footer-properties fo:min-height="0.5cm" fo:margin-top="0.3cm"/></style:footer-style>
 </style:page-layout>
</office:automatic-styles>
<office:master-styles>
 <style:master-page style:name="Standard" style:page-layout-name="pm1">${headerXml}${footerXml}</style:master-page>
</office:master-styles>
<office:body><office:text>${trackedChanges}${body}</office:text></office:body>
</office:document>
`
}

/** Zweispaltiges Layout: farbige Seitenleiste links, Inhalt rechts (als Tabelle) */
const sidebarLayout = (left, right) =>
  `<table:table table:name="Layout" table:style-name="Layout"><table:table-column table:style-name="Layout.A"/><table:table-column table:style-name="Layout.B"/><table:table-row><table:table-cell table:style-name="Layout.A1" office:value-type="string">${left}</table:table-cell><table:table-cell table:style-name="Layout.B1" office:value-type="string">${right}</table:table-cell></table:table-row></table:table>`

// ---------------------------------------------------------------------------
// Lebensläufe (frei erfunden)
// ---------------------------------------------------------------------------

/** 1 – Senior Backend (Kotlin/Java), Seitenleiste mit Foto, ohne Kennzahlen-Übertreibung */
const cvBackend = document({
  accent: '#1f3a5f',
  body: sidebarLayout(
    photo() +
      t('CV_SidebarHeading', 'Kontakt') +
      t('CV_Sidebar', 'Lena Hoffmann') +
      t('CV_Sidebar', 'Musterweg 12, 50667 Köln') +
      t('CV_Sidebar', '+49 151 0000 1201') +
      t('CV_Sidebar', 'lena.hoffmann@example.org') +
      p(
        'CV_Sidebar',
        link('https://github.com/lena-hoffmann-dev', 'github.com/lena-hoffmann-dev'),
      ) +
      t('CV_SidebarHeading', 'Kenntnisse') +
      labelLine('Sprachen', 'Kotlin, Java, SQL, Bash', 'CV_Sidebar') +
      labelLine('Frameworks', 'Spring Boot, Ktor, Hibernate', 'CV_Sidebar') +
      labelLine('Daten', 'PostgreSQL, Redis, Kafka', 'CV_Sidebar') +
      labelLine('Betrieb', 'Docker, Kubernetes, GitLab CI, AWS', 'CV_Sidebar') +
      t('CV_SidebarHeading', 'Sprachen') +
      t('CV_Sidebar', 'Deutsch (Muttersprache)') +
      t('CV_Sidebar', 'Englisch (verhandlungssicher)'),
    t('CV_Name', 'Lena Hoffmann') +
      t('CV_Role', 'Senior Backend-Entwicklerin') +
      heading('Profil') +
      t(
        'CV_Body',
        'Backend-Entwicklerin mit Schwerpunkt auf verteilten Systemen im E-Commerce. Ich entwickle stabile Schnittstellen, kümmere mich um saubere Datenmodelle und begleite Services vom Entwurf bis in den Betrieb.',
      ) +
      heading('Berufserfahrung') +
      entry({
        period: '04/2021 – heute',
        title: 'Senior Backend-Entwicklerin',
        org: 'Nordlicht Commerce GmbH, Köln',
        items: [
          'Entwicklung von Bestell- und Zahlungs-Services mit Kotlin und Spring Boot',
          'Umstellung der Kommunikation zwischen Services auf Kafka',
          'Betreuung von zwei Werkstudierenden und Durchführung von Code-Reviews',
          'Bereitschaftsdienst und Fehleranalyse im Produktivbetrieb',
        ],
      }) +
      entry({
        period: '09/2017 – 03/2021',
        title: 'Softwareentwicklerin Java',
        org: 'Rheinwerk Logistik AG, Bonn',
        items: [
          'Weiterentwicklung eines Lagerverwaltungssystems in Java',
          'Anbindung externer Speditionen über REST-Schnittstellen',
          'Einführung automatisierter Tests mit JUnit und Testcontainers',
        ],
      }) +
      heading('Ausbildung') +
      entry({
        period: '2013 – 2017',
        title: 'B. Sc. Informatik',
        org: 'Technische Hochschule Köln',
      }),
  ),
})

/** 2 – AI Engineer (LLM/RAG), Textrahmen für Kontakt, viele Kennzahlen (Plausibilitätsprüfung) */
const cvAiEngineer = document({
  accent: '#5a2ca0',
  body:
    p(
      'CV_Name',
      `${contactFrame([
        p('CV_Sidebar', `${span('CV_Label', 'E-Mail: ')}jonas.weber@example.net`),
        p('CV_Sidebar', `${span('CV_Label', 'Telefon: ')}+49 160 0000 2202`),
        p('CV_Sidebar', `${span('CV_Label', 'Ort: ')}München`),
        p(
          'CV_Sidebar',
          `${span('CV_Label', 'GitHub: ')}${link('https://github.com/jweber-ai', 'jweber-ai')}`,
        ),
      ])}Jonas Weber`,
    ) +
    t('CV_Role', 'AI Engineer · LLM-Anwendungen & MLOps') +
    heading('Profil') +
    t(
      'CV_Body',
      'AI Engineer mit Hintergrund in Softwareentwicklung. Ich baue LLM-Anwendungen, die im Alltag zuverlässig funktionieren: von der Datenaufbereitung über Retrieval und Evaluation bis zum Betrieb in der Cloud.',
    ) +
    heading('Berufserfahrung') +
    entry({
      period: '01/2023 – heute',
      title: 'AI Engineer',
      org: 'Datenwerk Analytics GmbH, München',
      items: [
        'Aufbau eines RAG-Assistenten für interne Wissensdatenbanken mit Python, LangChain und pgvector',
        'Evaluationspipeline mit 400 Testfragen; Antwortqualität in Nutzerbewertungen von 3,1 auf 4,2 von 5 verbessert',
        'Reduktion der Antwortzeit um 35 % durch Caching und kleinere Embedding-Modelle',
        'Betrieb der Modelle auf Kubernetes mit Monitoring über Prometheus und Grafana',
      ],
    }) +
    entry({
      period: '03/2020 – 12/2022',
      title: 'Machine Learning Engineer',
      org: 'Alpenblick Versicherung AG, München',
      items: [
        'Klassifikation eingehender Schadensmeldungen mit scikit-learn und später Transformer-Modellen',
        'Automatisierung von Training und Deployment mit MLflow und GitHub Actions',
        'Verarbeitung von rund 15.000 Dokumenten pro Tag',
      ],
    }) +
    entry({
      period: '08/2018 – 02/2020',
      title: 'Softwareentwickler Python',
      org: 'Isarcode Solutions GmbH, München',
      items: ['Entwicklung von Datenpipelines und REST-APIs mit FastAPI und PostgreSQL'],
    }) +
    heading('Kenntnisse') +
    labelLine('Programmierung', 'Python, TypeScript, SQL') +
    labelLine(
      'ML & LLM',
      'PyTorch, Hugging Face, LangChain, LlamaIndex, Embeddings, Prompt Engineering',
    ) +
    labelLine('MLOps', 'MLflow, Docker, Kubernetes, Terraform, Azure') +
    labelLine('Daten', 'PostgreSQL mit pgvector, Elasticsearch, Apache Airflow') +
    heading('Ausbildung') +
    entry({
      period: '2016 – 2018',
      title: 'M. Sc. Data Science',
      org: 'Ludwig-Maximilians-Universität München',
    }) +
    entry({ period: '2013 – 2016', title: 'B. Sc. Mathematik', org: 'Universität Augsburg' }),
})

/** 3 – Junior Frontend / Quereinsteigerin, einspaltig, schlicht, mit Links */
const juniorBody =
  t('CV_Name', 'Aylin Demir') +
  t('CV_Role', 'Junior Frontend-Entwicklerin') +
  p(
    'CV_Body',
    `Hamburg · aylin.demir@example.com · ${link('https://github.com/aylin-codes', 'github.com/aylin-codes')} · ${link('https://aylin-demir.example.com', 'Portfolio')}`,
  ) +
  heading('Über mich') +
  t(
    'CV_Body',
    'Nach meiner Ausbildung zur Mediengestalterin habe ich mich zur Frontend-Entwicklerin weitergebildet. Mir sind gut bedienbare Oberflächen wichtig, und ich lerne gerne im Team dazu.',
  ) +
  heading('Erfahrung') +
  entry({
    period: '10/2024 – heute',
    title: 'Junior Frontend-Entwicklerin',
    org: 'Hafenblick Digital GmbH, Hamburg',
    items: [
      'Umsetzung von Komponenten in React und TypeScript nach Figma-Vorlagen',
      'Mitarbeit an der Barrierefreiheit der Kundenportale',
      'Schreiben von Komponententests mit der Testing Library',
    ],
  }) +
  entry({
    period: '2019 – 2023',
    title: 'Mediengestalterin Digital und Print',
    org: 'Elbdruck Medien KG, Hamburg',
    items: ['Gestaltung von Webseiten und Newslettern, erste Erfahrungen mit HTML und CSS'],
  }) +
  heading('Weiterbildung') +
  entry({
    period: '2023 – 2024',
    title: 'Weiterbildung Webentwicklung (Vollzeit)',
    org: 'Code Akademie Nord',
  }) +
  entry({
    period: '2016 – 2019',
    title: 'Ausbildung Mediengestalterin',
    org: 'Berufsschule Medien Hamburg',
  }) +
  heading('Kenntnisse') +
  labelLine('Frontend', 'React, TypeScript, HTML, CSS, Tailwind') +
  labelLine('Werkzeuge', 'Git, Figma, Vite, Storybook') +
  labelLine('Sprachen', 'Deutsch, Türkisch (Muttersprache), Englisch (gut)')

const cvJunior = document({ accent: '#0f766e', body: juniorBody })

/** 4 – Englisch, AI-Lead, zwei Seiten, Kopf- und Fußzeile */
const cvLead = document({
  lang: 'en',
  country: 'GB',
  accent: '#9a3412',
  header: 'Curriculum Vitae – Dr. Michael Brandt',
  footer: 'Page',
  body:
    t('CV_Name', 'Dr. Michael Brandt') +
    t('CV_Role', 'Head of AI Engineering') +
    t('CV_Body', 'Berlin, Germany · michael.brandt@example.com · +49 170 0000 3303') +
    heading('Summary') +
    t(
      'CV_Body',
      'Data scientist turned engineering lead with eleven years of experience in machine learning. I build teams and platforms that take models from notebooks to reliable products, with a focus on responsible use of large language models.',
    ) +
    heading('Experience') +
    entry({
      period: '2022 – present',
      title: 'Head of AI Engineering',
      org: 'Spreewerk Mobility SE, Berlin',
      items: [
        'Lead a team of 9 engineers building LLM features for customer service and route planning',
        'Introduced an internal ML platform on Kubernetes with Kubeflow and a shared feature store',
        'Defined guidelines for evaluation, red-teaming and data protection of generative AI features',
        'Cut model deployment time from two weeks to one day',
      ],
    }) +
    entry({
      period: '2018 – 2022',
      title: 'Lead Data Scientist',
      org: 'Hanse Energie AG, Hamburg',
      items: [
        'Forecasting of energy demand with gradient boosting and deep learning models',
        'Built the first MLOps pipeline of the company with Airflow and MLflow',
        'Mentored 5 junior data scientists',
      ],
    }) +
    entry({
      period: '2015 – 2018',
      title: 'Data Scientist',
      org: 'Kiez Analytics GmbH, Berlin',
      items: [
        'Recommendation systems for online retail',
        'A/B testing and experimentation platform',
      ],
    }) +
    heading('Education') +
    entry({
      period: '2011 – 2015',
      title: 'PhD in Computer Science (Machine Learning)',
      org: 'Technische Universität Berlin',
    }) +
    entry({
      period: '2009 – 2011',
      title: 'M. Sc. Computer Science',
      org: 'Technische Universität Berlin',
    }) +
    heading('Skills') +
    labelLine('Languages', 'Python, SQL, Go, Scala') +
    labelLine(
      'Machine learning',
      'PyTorch, XGBoost, Transformers, LLM fine-tuning, RAG, evaluation',
    ) +
    labelLine('Platform', 'Kubernetes, Kubeflow, Terraform, Google Cloud, AWS') +
    labelLine('Leadership', 'Hiring, roadmap planning, stakeholder management') +
    heading('Publications and talks') +
    bullets([
      'Brandt, M. et al.: Reliable demand forecasting for regional energy grids. Conference paper, 2019',
      'Talk: Evaluating LLM assistants before they reach customers. Data Conference Berlin, 2024',
      'Talk: From notebook to platform – lessons from building an ML platform. MLOps Meetup, 2023',
    ]) +
    heading('Languages') +
    t('CV_Body', 'German (native), English (fluent), Spanish (basic)'),
})

/** 5 – Junior-CV mit nachverfolgter Änderung (soll mit Hinweis abgelehnt werden) */
const cvTracked = document({
  accent: '#0f766e',
  trackedChanges:
    '<text:tracked-changes><text:changed-region text:id="ct1"><text:insertion><office:change-info><dc:creator>Aylin Demir</dc:creator><dc:date>2026-11-10T09:30:00</dc:date></office:change-info></text:insertion></text:changed-region></text:tracked-changes>',
  body: juniorBody.replace(
    'Mir sind gut bedienbare Oberflächen wichtig',
    'Mir sind gut bedienbare <text:change-start text:change-id="ct1"/>und barrierefreie <text:change-end text:change-id="ct1"/>Oberflächen wichtig',
  ),
})

// ---------------------------------------------------------------------------
// Stellenanzeigen (frei erfunden)
// ---------------------------------------------------------------------------

const POSTINGS = {
  'stelle-a-ai-engineer-llm.txt': `AI Engineer (m/w/d) – LLM-Anwendungen
Kompass Health GmbH, Berlin oder remote

Deine Aufgaben
- Du entwickelst LLM-basierte Assistenten für Ärztinnen und Pflegekräfte (Retrieval-Augmented Generation).
- Du baust Evaluationsverfahren für Antwortqualität, Halluzinationen und Datenschutz auf.
- Du bringst Modelle mit unserem Plattform-Team in den Betrieb (Docker, Kubernetes, Azure).
- Du arbeitest eng mit Produkt und Medizin zusammen und erklärst technische Entscheidungen verständlich.

Das bringst du mit
- Mehrjährige Erfahrung mit Python und Machine Learning
- Praxis mit LLM-Frameworks (LangChain, LlamaIndex o. ä.), Embeddings und Vektordatenbanken (z. B. pgvector)
- Erfahrung mit Prompt Engineering und der Evaluation generativer Modelle
- MLOps-Kenntnisse: MLflow, CI/CD, Monitoring
- Wünschenswert: Erfahrung mit sensiblen Daten (DSGVO), TypeScript für Prototypen
- Sehr gute Deutsch- und Englischkenntnisse
`,
  'stelle-b-senior-backend-kotlin.txt': `Senior Backend Engineer Kotlin (m/w/d)
Fahrwerk Mobility GmbH, Köln (hybrid)

Deine Aufgaben
- Entwicklung und Betrieb von Microservices für unsere Buchungsplattform
- Gestaltung von APIs und ereignisgetriebener Kommunikation mit Kafka
- Verantwortung für Qualität: Tests, Code-Reviews, Observability
- Mentoring von jüngeren Teammitgliedern

Dein Profil
- 5+ Jahre Erfahrung in der Backend-Entwicklung mit Kotlin oder Java
- Sehr gute Kenntnisse in Spring Boot und PostgreSQL
- Erfahrung mit Kafka, Docker und Kubernetes
- Cloud-Erfahrung (AWS), Infrastructure as Code (Terraform) ist ein Plus
- Erfahrung mit Domain-Driven Design wünschenswert
`,
  'stelle-c-frontend-react.txt': `Frontend-Entwickler:in React (Junior/Mid)
Lotsenhaus Software GmbH, Hamburg

Was dich erwartet
- Du entwickelst neue Funktionen für unsere Web-App mit React, TypeScript und Next.js.
- Du sorgst für Barrierefreiheit (WCAG 2.2) und gute Performance.
- Du schreibst Tests mit Vitest, Testing Library und Playwright.
- Du arbeitest eng mit UX-Design in Figma zusammen und pflegst unser Design-System in Storybook.

Was du mitbringst
- Erste Berufserfahrung mit React und TypeScript
- Sicherer Umgang mit HTML, CSS und Tailwind
- Interesse an Barrierefreiheit und Design-Systemen
- Grundkenntnisse in Git und CI/CD
- Teamgeist und Lust, Neues zu lernen
`,
  'stelle-d-ml-platform-engineer-en.txt': `ML Platform Engineer (f/m/d)
Brightline Logistics, Berlin

About the role
- Design and run our machine learning platform on Kubernetes (Kubeflow, MLflow, feature store).
- Enable data scientists to train, evaluate and deploy models, including LLM-based services.
- Automate infrastructure with Terraform on Google Cloud and AWS.
- Set standards for model monitoring, evaluation and responsible AI.

What you bring
- Several years of experience in MLOps or platform engineering
- Strong Python skills, Go is a plus
- Hands-on experience with Kubernetes, Kubeflow and MLflow
- Experience leading teams or technical initiatives
- Excellent English, German is a plus
`,
}

// ---------------------------------------------------------------------------
// Erzeugen
// ---------------------------------------------------------------------------

const CVS = [
  { name: '01-backend-lena-hoffmann', xml: cvBackend, formats: ['docx', 'odt'] },
  { name: '02-ai-engineer-jonas-weber', xml: cvAiEngineer, formats: ['docx', 'odt', 'pdf'] },
  { name: '03-junior-frontend-aylin-demir', xml: cvJunior, formats: ['docx', 'odt'] },
  { name: '04-ai-lead-michael-brandt-en', xml: cvLead, formats: ['docx', 'odt'] },
  { name: '05-aenderungen-nachverfolgt', xml: cvTracked, formats: ['docx', 'odt'] },
]

const FILTERS = { docx: 'docx:MS Word 2007 XML', odt: 'odt', pdf: 'pdf' }

await mkdir(OUT, { recursive: true })
const work = await mkdtemp(join(tmpdir(), 'bewerbery-cv-samples-'))
try {
  for (const cv of CVS) {
    const source = join(work, `${cv.name}.fodt`)
    await writeFile(source, cv.xml, 'utf8')
    for (const format of cv.formats) {
      execFileSync(
        SOFFICE,
        ['--headless', '--convert-to', FILTERS[format], '--outdir', work, source],
        {
          stdio: 'ignore',
        },
      )
      await copyFile(join(work, `${cv.name}.${format}`), join(OUT, `${cv.name}.${format}`))
      console.log(`✓ ${cv.name}.${format}`)
    }
  }
  for (const [file, text] of Object.entries(POSTINGS)) {
    await writeFile(join(OUT, file), text, 'utf8')
    console.log(`✓ ${file}`)
  }
} finally {
  if (process.env.KEEP_WORK) console.log(`Arbeitsordner: ${work}`)
  else await rm(work, { recursive: true, force: true })
}
