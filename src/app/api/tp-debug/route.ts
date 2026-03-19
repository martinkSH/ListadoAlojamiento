import { NextRequest, NextResponse } from 'next/server'
import * as sql from 'mssql'

export async function GET(req: NextRequest) {
  const supplier = req.nextUrl.searchParams.get('supplier')
  if (!supplier) return NextResponse.json({ error: 'supplier required' }, { status: 400 })

  const config: sql.config = {
    server: 'LA-SAYHUE.data.tourplan.net',
    port: 50409,
    database: 'LA-SAYHUE',
    user: 'excelLA-SAYHUE',
    password: process.env.TP_PASSWORD ?? 'o6rmFv7$RJnp14NzqI18',
    options: { encrypt: true, trustServerCertificate: true, connectTimeout: 30000, requestTimeout: 60000 },
  }

  try {
    const pool = await sql.connect(config)

    // Raw query — no filters, just show what TP has for this supplier
    const result = await pool.request().query(`
      SELECT TOP 50
        OPT.SUPPLIER,
        OPT.DESCRIPTION AS optionDesc,
        OPT.AC,
        OSR.PRICE_CODE,
        OSR.DATE_FROM,
        OSR.DATE_TO,
        OPD.RATE_TYPE,
        OPD.AGE_CATEGORY,
        OPD.SS AS sgl,
        OPD.TW AS dbl,
        OPD.TR AS tpl
      FROM OPT
      JOIN OSR ON OSR.OPT_ID = OPT.OPT_ID
      JOIN OPD ON OPD.OSR_ID = OSR.OSR_ID
      WHERE OPT.SUPPLIER = '${supplier}'
      AND OSR.DATE_TO >= CONVERT(varchar, GETDATE(), 112)
      ORDER BY OSR.DATE_FROM, OPT.DESCRIPTION
    `)

    await pool.close()
    return NextResponse.json({ supplier, rows: result.recordset })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
