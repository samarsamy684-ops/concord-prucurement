import { get } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

function isOwnedPath(pathname: string, userId: string) {
  return pathname.startsWith(`vendor-qualification/${userId}/`) && !pathname.includes('..')
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pathname = request.nextUrl.searchParams.get('pathname') ?? ''
  if (!isOwnedPath(pathname, session.user.id)) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

  try {
    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })
    if (!result) return NextResponse.json({ error: 'File not found.' }, { status: 404 })
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' } })

    const fileName = result.blob.pathname.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_') ?? 'vendor-document'
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Content-Type-Options': 'nosniff',
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not load this vendor document.' }, { status: 500 })
  }
}
