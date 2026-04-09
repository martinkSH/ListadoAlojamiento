import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  try {
    // Verificar que viene con un token simple de seguridad
    const { query, secret } = await request.json()
    
    // Token de seguridad simple (puedes cambiarlo)
    const EXECUTION_SECRET = process.env.SQL_EXECUTION_SECRET || 'change-me-in-production'
    
    if (secret !== EXECUTION_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }
    
    // Solo permitir SELECT queries por seguridad
    const trimmedQuery = query.trim().toLowerCase()
    if (!trimmedQuery.startsWith('select')) {
      return NextResponse.json({ 
        error: 'Only SELECT queries are allowed for security reasons' 
      }, { status: 403 })
    }
    
    console.log('[execute-sql] Running query:', query.substring(0, 100) + '...')
    
    // Crear cliente admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Ejecutar query directamente usando el cliente de Supabase
    // Nota: Esto solo funciona con queries simples de tablas directas
    // Para JOINs complejos, necesitamos usar PostgREST directamente
    
    // Hacer la query usando fetch directo al endpoint de Postgres
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: query 
    })
    
    if (error) {
      console.error('[execute-sql] Supabase error:', error)
      return NextResponse.json({ 
        error: error.message,
        hint: 'You may need to create the exec_sql function in Supabase',
        details: error
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true,
      data: data,
      rowCount: Array.isArray(data) ? data.length : 0
    })
    
  } catch (error: any) {
    console.error('[execute-sql] Error executing query:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to execute query',
      details: error.toString()
    }, { status: 500 })
  }
}

// GET endpoint para verificar que está funcionando
export async function GET() {
  return NextResponse.json({ 
    message: 'SQL Execution API is running',
    usage: 'POST with { query: "SELECT ...", secret: "your-secret" }',
    note: 'Only SELECT queries are allowed'
  })
}
