import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) {
    return false
  }

  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
  const expectedBuf = Buffer.from(expected)
  const receivedBuf = Buffer.from(signatureHeader)

  if (expectedBuf.length !== receivedBuf.length) {
    return false
  }

  return timingSafeEqual(expectedBuf, receivedBuf)
}

export function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) {
    return false
  }
  return timingSafeEqual(aBuf, bBuf)
}
