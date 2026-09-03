const encoder = new TextEncoder();

const CONTENT_TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_CELL_TEXT = 32000;

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanCellText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .slice(0, MAX_CELL_TEXT);
}

function inlineCell(reference, value, style = 0) {
  if (value === null || value === undefined || value === "") {
    return `<c r="${reference}" s="${style}"/>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cleanCellText(value))}</t></is></c>`;
}

function formulaCell(reference, formula, style = 0) {
  return `<c r="${reference}" s="${style}"><f>${xmlEscape(formula)}</f><v>0</v></c>`;
}

function worksheetXml({ rows, columns, mergedCells = [], drawing = false, autoFilter = "", freezeRows = 1 }) {
  const rowXml = rows
    .map(({ number, height, cells }) => `<row r="${number}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells.join("")}</row>`)
    .join("");
  const mergeXml = mergedCells.length
    ? `<mergeCells count="${mergedCells.length}">${mergedCells.map((range) => `<mergeCell ref="${range}"/>`).join("")}</mergeCells>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:H${Math.max(1, rows.at(-1)?.number || 1)}"/>
  <sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columns.map(({ min, max = min, width }) => `<col min="${min}" max="${max}" width="${width}" customWidth="1"/>`).join("")}</cols>
  <sheetData>${rowXml}</sheetData>
  ${autoFilter ? `<autoFilter ref="${autoFilter}"/>` : ""}
  ${mergeXml}
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
  ${drawing ? '<drawing r:id="rId1"/>' : ""}
</worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="¥#,##0"/><numFmt numFmtId="165" formatCode="#,##0"/></numFmts>
  <fonts count="4">
    <font><sz val="10"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/><family val="2"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><sz val="10"/><color rgb="FF1F2937"/><name val="Aptos"/><family val="2"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF115E59"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD9E2E8"/></left><right style="thin"><color rgb="FFD9E2E8"/></right><top style="thin"><color rgb="FFD9E2E8"/></top><bottom style="thin"><color rgb="FFD9E2E8"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="3" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function contentTypesXml(imageCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageCount ? '<Default Extension="jpg" ContentType="image/jpeg"/>' : ""}
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${imageCount ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ""}
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function drawingXml(images) {
  const anchors = images.map(({ rowNumber }, index) => {
    const row = rowNumber - 1;
    return `<xdr:twoCellAnchor editAs="oneCell">
      <xdr:from><xdr:col>0</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>47625</xdr:rowOff></xdr:from>
      <xdr:to><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
      <xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index + 2}" name="Product ${index + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${index + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm/><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>
      <xdr:clientData/>
    </xdr:twoCellAnchor>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`;
}

function drawingRelationshipsXml(images) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${images.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${index + 1}.jpg"/>`).join("")}</Relationships>`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeU32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function zipStore(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0x0800);
    writeU16(localView, 8, 0);
    writeU32(localView, 14, checksum);
    writeU32(localView, 18, data.length);
    writeU32(localView, 22, data.length);
    writeU16(localView, 26, name.length);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0x0800);
    writeU16(centralView, 10, 0);
    writeU32(centralView, 16, checksum);
    writeU32(centralView, 20, data.length);
    writeU32(centralView, 24, data.length);
    writeU16(centralView, 28, name.length);
    writeU32(centralView, 42, localOffset);
    central.set(name, 46);

    localParts.push(local, data);
    centralParts.push(central);
    localOffset += local.length + data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 8, entries.length);
  writeU16(endView, 10, entries.length);
  writeU32(endView, 12, centralDirectory.length);
  writeU32(endView, 16, localOffset);
  return concatBytes([...localParts, centralDirectory, end]);
}

function requestedSpecification(item, record = null) {
  if (record?.variantLabel) return record.variantLabel;
  if (item.selectedVariant) return item.selectedVariant;
  if (item.variants) return `Selection to confirm. Available: ${item.variants}`;
  return "Standard product / to confirm";
}

export function buildQuoteWorkbook({ submission, priceRecords = [], imageAssets = [] }) {
  const priceMap = new Map(priceRecords.filter((record) => !record.variantId).map((record) => [record.model, record]));
  const variantPriceMap = new Map(priceRecords.filter((record) => record.variantId).map((record) => [`${record.model}::${record.variantId}`, record]));
  const priceRecordFor = (item) => item.variantId
    ? variantPriceMap.get(`${item.model}::${item.variantId}`)
    : priceMap.get(item.model);
  const imageMap = new Map(imageAssets.map((asset) => [asset.itemIndex, asset]));
  const embeddedImages = [];

  const customerRows = [
    { number: 1, height: 30, cells: [inlineCell("A1", "Herui Lighting — Customer Quote Request", 1)] },
    { number: 2, cells: [inlineCell("A2", "Inquiry ID", 3), inlineCell("B2", submission.inquiryId, 11)] },
    { number: 3, cells: [inlineCell("A3", "Submitted at", 3), inlineCell("B3", submission.submittedAt, 11)] },
    { number: 4, cells: [inlineCell("A4", "Buyer contact", 3), inlineCell("B4", submission.buyer?.contact || "", 11)] },
    { number: 5, cells: [inlineCell("A5", "Destination", 3), inlineCell("B5", submission.buyer?.destination || "To confirm", 11)] },
    { number: 6, height: 30, cells: [inlineCell("A6", "Project notes", 3), inlineCell("B6", submission.buyer?.notes || "None provided", 11)] },
    { number: 8, height: 28, cells: [
      inlineCell("A8", "Product image", 2),
      inlineCell("B8", "Herui catalog model", 2),
      inlineCell("C8", "Product name", 2),
      inlineCell("D8", "Specification / option", 2),
      inlineCell("E8", "Quantity", 2),
    ] },
  ];

  submission.items.forEach((item, itemIndex) => {
    const rowNumber = itemIndex + 9;
    const asset = imageMap.get(itemIndex);
    const record = priceRecordFor(item);
    if (asset?.bytes?.length) embeddedImages.push({ ...asset, rowNumber });
    customerRows.push({
      number: rowNumber,
      height: 72,
      cells: [
        inlineCell(`A${rowNumber}`, asset?.bytes?.length ? "" : "See website image", 4),
        inlineCell(`B${rowNumber}`, item.model, 4),
        inlineCell(`C${rowNumber}`, item.name || item.model, 4),
        inlineCell(`D${rowNumber}`, requestedSpecification(item, record), 4),
        inlineCell(`E${rowNumber}`, Number(item.quantity) || 1, 5),
      ],
    });
  });

  const internalRows = [
    { number: 1, height: 30, cells: [inlineCell("A1", "Herui Lighting — Internal Price Match", 1)] },
    { number: 2, cells: [inlineCell("A2", "Inquiry ID", 3), inlineCell("B2", submission.inquiryId, 11)] },
    { number: 3, cells: [inlineCell("A3", "Quote basis", 3), inlineCell("B3", "Source Price / RMB — internal reference only", 11)] },
    { number: 4, height: 28, cells: [inlineCell("A4", "Important", 3), inlineCell("B4", "Review costs, freight, margin and commercial terms before sending any quotation to the buyer.", 11)] },
    { number: 6, height: 30, cells: [
      inlineCell("A6", "Herui catalog model", 2),
      inlineCell("B6", "Product name", 2),
      inlineCell("C6", "Specification / option", 2),
      inlineCell("D6", "Quantity", 2),
      inlineCell("E6", "Source unit price / RMB", 2),
      inlineCell("F6", "Cost subtotal / RMB", 2),
      inlineCell("G6", "Match status", 2),
      inlineCell("H6", "Review note / source", 2),
    ] },
  ];

  submission.items.forEach((item, itemIndex) => {
    const rowNumber = itemIndex + 7;
    const record = priceRecordFor(item);
    const matched = record?.priceStatus === "matched" && Number.isFinite(record.sourcePriceRmb);
    const status = matched ? "Matched automatically" : record?.priceStatus === "missing" ? "Missing price" : "Manual review required";
    const statusStyle = matched ? 7 : record?.priceStatus === "missing" ? 9 : 8;
    const note = matched
      ? `${record.variantId ? `Exact option matched; ${record.effectiveUnit || "per piece"}; ` : ""}Quote Catalog row ${record.sourceRow}`
      : record?.sourcePriceText
        ? `${record.mappingNote || "Multiple or labelled source prices; supplier confirmation required."} Review Quote Catalog row ${record.sourceRow}`
        : record
          ? `No source price; Quote Catalog row ${record.sourceRow}`
          : item.variantId
            ? "Selected option was not found in the private variant price map"
            : "Model not found in private price catalog";

    internalRows.push({
      number: rowNumber,
      height: 42,
      cells: [
        inlineCell(`A${rowNumber}`, item.model, 4),
        inlineCell(`B${rowNumber}`, item.name || item.model, 4),
        inlineCell(`C${rowNumber}`, requestedSpecification(item, record), 4),
        inlineCell(`D${rowNumber}`, Number(item.quantity) || 1, 5),
        matched ? inlineCell(`E${rowNumber}`, record.sourcePriceRmb, 6) : inlineCell(`E${rowNumber}`, "", 6),
        matched ? formulaCell(`F${rowNumber}`, `D${rowNumber}*E${rowNumber}`, 6) : inlineCell(`F${rowNumber}`, "", 6),
        inlineCell(`G${rowNumber}`, status, statusStyle),
        inlineCell(`H${rowNumber}`, note, 4),
      ],
    });
  });

  const totalRow = submission.items.length + 8;
  internalRows.push({
    number: totalRow,
    height: 24,
    cells: [
      inlineCell(`A${totalRow}`, "Internal matched-cost total", 3),
      inlineCell(`D${totalRow}`, "", 3),
      formulaCell(`F${totalRow}`, `SUM(F7:F${totalRow - 1})`, 10),
      inlineCell(`G${totalRow}`, "Unmatched rows excluded", 8),
      inlineCell(`H${totalRow}`, "Do not send this sheet to the customer.", 11),
    ],
  });

  const customerSheet = worksheetXml({
    rows: customerRows,
    columns: [
      { min: 1, width: 17 }, { min: 2, width: 22 }, { min: 3, width: 30 },
      { min: 4, width: 52 }, { min: 5, width: 12 },
    ],
    mergedCells: ["A1:E1", "B2:E2", "B3:E3", "B4:E4", "B5:E5", "B6:E6"],
    drawing: embeddedImages.length > 0,
    autoFilter: `A8:E${Math.max(8, submission.items.length + 8)}`,
    freezeRows: 8,
  });
  const internalSheet = worksheetXml({
    rows: internalRows,
    columns: [
      { min: 1, width: 22 }, { min: 2, width: 30 }, { min: 3, width: 52 },
      { min: 4, width: 11 }, { min: 5, width: 22 }, { min: 6, width: 22 },
      { min: 7, width: 24 }, { min: 8, width: 45 },
    ],
    mergedCells: ["A1:H1", "B2:H2", "B3:H3", "B4:H4"],
    autoFilter: `A6:H${Math.max(6, submission.items.length + 6)}`,
    freezeRows: 6,
  });

  const now = new Date().toISOString();
  const entries = [
    { name: "[Content_Types].xml", data: contentTypesXml(embeddedImages.length) },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Herui Lighting Quote Request</dc:title><dc:creator>Herui Lighting</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>` },
    { name: "docProps/app.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Herui Lighting</Application></Properties>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Customer Request" sheetId="1" r:id="rId1"/><sheet name="Internal Price Match" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: stylesXml() },
    { name: "xl/worksheets/sheet1.xml", data: customerSheet },
    { name: "xl/worksheets/sheet2.xml", data: internalSheet },
  ];

  if (embeddedImages.length) {
    entries.push(
      { name: "xl/worksheets/_rels/sheet1.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>` },
      { name: "xl/drawings/drawing1.xml", data: drawingXml(embeddedImages) },
      { name: "xl/drawings/_rels/drawing1.xml.rels", data: drawingRelationshipsXml(embeddedImages) },
    );
    embeddedImages.forEach((image, index) => entries.push({ name: `xl/media/image${index + 1}.jpg`, data: image.bytes }));
  }

  return {
    bytes: zipStore(entries),
    contentType: CONTENT_TYPE_XLSX,
    embeddedImageCount: embeddedImages.length,
  };
}
