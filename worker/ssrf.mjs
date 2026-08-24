import net from 'net'

const dnsPromises = import('dns/promises')

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      a >= 224
    )
  }
  const v6 = ip.toLowerCase()
  return (
    v6 === '::1' ||
    v6 === '::' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe80') ||
    v6.startsWith('::ffff:127.')
  )
}

/** SSRF guard — only public http(s) targets may reach yt-dlp. */
export async function assertPublicHttpUrl(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed')
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
  const dns = await dnsPromises

  const candidates = net.isIP(hostname)
    ? [hostname]
    : (await dns.lookup(hostname, { all: true })).map((r) => r.address)
  if (candidates.length === 0) throw new Error('Could not resolve host')

  for (const ip of candidates) {
    if (isPrivateIp(ip)) {
      throw new Error(`Blocked non-public address for host ${hostname}`)
    }
  }
}
