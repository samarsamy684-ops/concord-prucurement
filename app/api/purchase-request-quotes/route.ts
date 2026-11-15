import { del, get, put } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const allowedContentTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
const maxFileSize = 10 * 1024 * 1024
const maxFilesPerLine = 5

async function getSession(request: NextRequest) {
  return auth.api.getSession({ headers: request.headers })
}

function isOwnedPath(pathname: string, userId: string) {
  return pathname.startsWith(`purchase-request-quotes/${userId}/`) && !pathname.includes('..')
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const draftId = String(formData.get('draftId') ?? '')
  const lineId = String(formData.get('lineId') ?? '')
  const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File)

  if (!/^[a-f0-9-]{36}$/i.test(draftId) || !/^line-[a-zA-Z0-9-]{1,80}$/.test(lineId)) {
    return NextResponse.json({ error: 'Invalid request line.' }, { status: 400 })
  }
  if (files.length === 0 || files.length > maxFilesPerLine) {
    return NextResponse.json({ error: `Choose between 1 and ${maxFilesPerLine} quote files.` }, { status: 400 })
  }
  if (files.some((file) => file.size === 0 || file.size > maxFileSize || !allowedContentTypes.has(file.type))) {
    return NextResponse.json({ error: 'Quotes must be PDF, PNG, JPG or Excel files no larger than 10 MB.' }, { status: 400 })
  }

  try {
    const attachments = await Promise.all(files.map(async (file) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'quote'
      const pathname = `purchase-request-quotes/${session.user.id}/${draftId}/${lineId}/${crypto.randomUUID()}-${safeName}`
      const blob = await put(pathname, file, { access: 'private', addRandomSuffix: false, contentType: file.type })
      return { pathname: blob.pathname, fileName: safeName, contentType: file.type, size: file.size }
    }))
    return NextResponse.json({ attachments }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Quote upload failed. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(request)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { pathname?: unknown } | null
  const pathname = typeof body?.pathname === 'string' ? body.pathname : ''
  if (!isOwnedPath(pathname, session.user.id)) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

  try {
    await del(pathname)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Could not remove this quote.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pathname = request.nextUrl.searchParams.get('pathname') ?? ''
  if (!isOwnedPath(pathname, session.user.id)) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

  try {
    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })
    if (!result) return NextResponse.json({ error: 'File not found.' }, { status: 404 })
    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' },
      })
    }

    const fileName = result.blob.pathname.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_') ?? 'quote'
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not load this quote.' }, { status: 500 })
  }
}
