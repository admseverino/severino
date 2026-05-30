import { renderQrSvg } from '@/modules/meters/qr'

export async function renderPhoneVerificationQr(whatsappUrl: string): Promise<string> {
  return renderQrSvg(whatsappUrl)
}
