import ExcelJS from 'exceljs'

export type ExcelCell = string | number | boolean | Date | null | undefined

export interface ExcelReportOptions {
  fileName: string
  sheetName: string
  headers: string[]
  rows: ExcelCell[][]
  textColumns?: number[]
  wideColumns?: number[]
  dateColumns?: number[]
  currencyColumns?: number[]
  centerColumns?: number[]
  leftColumns?: number[]
  rightColumns?: number[]
  wrapColumns?: number[]
  columnWidths?: number[]
}

const toColumnLetter = (columnNumber: number) => {
  let temp = columnNumber
  let letter = ''

  while (temp > 0) {
    const remainder = (temp - 1) % 26
    letter = String.fromCharCode(65 + remainder) + letter
    temp = Math.floor((temp - 1) / 26)
  }

  return letter
}

export async function downloadExcelReport({
  fileName,
  sheetName,
  headers,
  rows,
  textColumns = [],
  wideColumns = [],
  dateColumns = [],
  currencyColumns = [],
  centerColumns = [],
  leftColumns = [],
  rightColumns = [],
  wrapColumns = [],
  columnWidths = [],
}: ExcelReportOptions) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)

  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  const lastColumn = Math.max(headers.length, 1)
  worksheet.autoFilter = `A1:${toColumnLetter(lastColumn)}1`

  worksheet.addRow(headers)
  rows.forEach((row) => worksheet.addRow(row))

  const headerRow = worksheet.getRow(1)
  headerRow.height = 28
  headerRow.eachCell((cell, columnNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF06283D' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB6C2CF' } },
      bottom: { style: 'thin', color: { argb: 'FFB6C2CF' } },
      left: { style: 'thin', color: { argb: 'FFB6C2CF' } },
      right: { style: 'thin', color: { argb: 'FFB6C2CF' } },
    }
    cell.numFmt = '@'
    if (columnNumber === 1) {
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    }
  })

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const longestCell = row.values.slice(1).reduce((longest, value) => {
      const text = value == null ? '' : String(value)
      return Math.max(longest, text.length)
    }, 0)

    row.height = Math.min(Math.max(22, 18 + Math.ceil(longestCell / 28) * 12), 90)
    row.eachCell((cell, columnNumber) => {
      const index = columnNumber - 1

      if (textColumns.includes(index)) {
        cell.numFmt = '@'
      }

      if (dateColumns.includes(index)) {
        cell.numFmt = 'dd-mm-yyyy'
      }

      if (currencyColumns.includes(index)) {
        cell.numFmt = '[$₹-en-IN]#,##0.00'
      }

      if (centerColumns.includes(index)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      } else if (rightColumns.includes(index)) {
        cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }
      } else if (leftColumns.includes(index)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
      }

      if (wrapColumns.includes(index)) {
        cell.alignment = { ...(cell.alignment || {}), wrapText: true }
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    })
  })

  worksheet.columns.forEach((column, columnIndex) => {
    const customWidth = columnWidths[columnIndex]
    if (customWidth) {
      column.width = customWidth
      return
    }

    let width = headers[columnIndex]?.length ?? 12
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? '' : String(cell.value)
      const lines = value.split(/\r?\n/)
      width = Math.max(width, ...lines.map((line) => line.length))
    })

    const maxAllowed = wideColumns.includes(columnIndex) ? 60 : 40
    const minimum = columnIndex === 0 ? 18 : 14
    column.width = Math.min(Math.max(width + 3, minimum), maxAllowed)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
