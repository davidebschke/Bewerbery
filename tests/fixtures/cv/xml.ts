/**
 * XML-Teile der CV-Testdokumente. Bewusst mit den Strukturen, die echte
 * Lebensläufe aus Word bzw. LibreOffice enthalten.
 */

const W_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" ' +
  'xmlns:v="urn:schemas-microsoft-com:vml" mc:Ignorable="wps"'

const BOLD = '<w:rPr><w:b/><w:color w:val="1F4E79"/></w:rPr>'
const NORMAL = '<w:rPr><w:sz w:val="22"/></w:rPr>'

/** word/document.xml eines gestalteten Lebenslaufs */
export const DOCX_DOCUMENT_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ${W_NS}><w:body>` +
  // p0: Überschrift
  `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r>${BOLD}<w:t>Max Mustermann</w:t></w:r></w:p>` +
  // p1: fettes Label + normaler Text, von Word in zwei Läufe mit gleicher Formatierung zerlegt
  `<w:p w:rsidR="00A1"><w:r>${BOLD}<w:t xml:space="preserve">Skills: </w:t></w:r>` +
  `<w:r w:rsidR="00B2">${NORMAL}<w:t>Type</w:t></w:r><w:r w:rsidR="00C3">${NORMAL}<w:t>Script, React</w:t></w:r></w:p>` +
  // p2: Zeitraum, Tabulator, Position
  `<w:p><w:r><w:t>2019 – 2023</w:t></w:r><w:r><w:tab/><w:t>Frontend-Entwickler</w:t></w:r></w:p>` +
  // p3: Tabelle
  `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Teamarbeit &amp; Kommunikation</w:t></w:r></w:p></w:tc></w:tr></w:tbl>` +
  // p4 + p5: Textfeld (DrawingML) mit VML-Fallback, der ignoriert wird
  `<w:p><w:r><w:t>Profil</w:t></w:r><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wps:txbx><w:txbxContent>` +
  `<w:p><w:r>${NORMAL}<w:t>Kontakt: max@example.com</w:t></w:r></w:p>` +
  `</w:txbxContent></wps:txbx></w:drawing></mc:Choice><mc:Fallback><w:pict><v:textbox><w:txbxContent>` +
  `<w:p><w:r>${NORMAL}<w:t>Kontakt: max@example.com</w:t></w:r></w:p>` +
  `</w:txbxContent></v:textbox></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>` +
  // p6: Feld (Seitenzahl) – Feldergebnis wird nicht bearbeitet
  `<w:p><w:r><w:t xml:space="preserve">Seite </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
  `<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
  `<w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>` +
  // leerer Absatz – erscheint nicht
  `<w:p/><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>` +
  // p7: Zeilenumbruch im Lauf
  `<w:p><w:r><w:t>Zeile eins</w:t><w:br/><w:t>Zeile zwei</w:t></w:r></w:p>` +
  // p8: Hyperlink
  `<w:p><w:r><w:t xml:space="preserve">Portfolio: </w:t></w:r><w:hyperlink r:id="rId5"><w:r><w:t>github.com/max</w:t></w:r></w:hyperlink></w:p>` +
  // p9: einfaches Feld wird ignoriert
  `<w:p><w:r><w:t xml:space="preserve">Stand: </w:t></w:r><w:fldSimple w:instr=" DATE "><w:r><w:t>17.11.2026</w:t></w:r></w:fldSimple></w:p>` +
  `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`

/** Dokument mit nachverfolgten Änderungen */
export const DOCX_TRACKED_XML =
  `<w:document ${W_NS}><w:body><w:p><w:r><w:t>Alt</w:t></w:r>` +
  `<w:ins w:id="1" w:author="Max"><w:r><w:t>Neu</w:t></w:r></w:ins></w:p></w:body></w:document>`

/** Dokument ohne Text (z. B. nur ein Bild) */
export const DOCX_EMPTY_XML = `<w:document ${W_NS}><w:body><w:p><w:r><w:drawing/></w:r></w:p></w:body></w:document>`

const ODT_NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" ' +
  'xmlns:xlink="http://www.w3.org/1999/xlink" office:version="1.3"'

/** content.xml eines gestalteten LibreOffice-Lebenslaufs */
export const ODT_CONTENT_XML =
  `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content ${ODT_NS}>` +
  `<office:automatic-styles/><office:body><office:text>` +
  // p0: Überschrift
  `<text:h text:style-name="H1" text:outline-level="1">Max Mustermann</text:h>` +
  // p1: Span-Label + direkter Text
  `<text:p text:style-name="P1"><text:span text:style-name="T1">Profil: </text:span>Erfahrener Entwickler</text:p>` +
  // p2: text:s gehört zum Segment, Tabulator trennt
  `<text:p>Skills:<text:s/>Rust<text:s text:c="2"/>Go<text:tab/>Python</text:p>` +
  // p3 + p4: Rahmen mit Textfeld
  `<text:p><draw:frame draw:name="Box"><draw:text-box><text:p>Kontakt</text:p></draw:text-box></draw:frame>Weiter</text:p>` +
  // p5: Kommentar wird ignoriert
  `<text:p>Text<office:annotation><text:p>Kommentar</text:p></office:annotation></text:p>` +
  // p6: Zeilenumbruch und Link
  `<text:p>Zeile eins<text:line-break/>Mehr unter <text:a xlink:href="https://github.com/max">github.com/max</text:a></text:p>` +
  // p7: Feld (Seitenzahl) wird ignoriert
  `<text:p>Seite <text:page-number>1</text:page-number></text:p>` +
  `<text:p/>` +
  `</office:text></office:body></office:document-content>`

/** ODT mit Änderungsverfolgung */
export const ODT_TRACKED_XML =
  `<office:document-content ${ODT_NS}><office:body><office:text>` +
  `<text:tracked-changes><text:changed-region text:id="c1"/></text:tracked-changes>` +
  `<text:p>Text</text:p></office:text></office:body></office:document-content>`
