import { createServer } from 'node:net';

async function isAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') resolve(false);
      // IPv6 may be disabled on the machine. The IPv4 check still applies.
      else if (['::', '::1'].includes(host) && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code ?? '')) resolve(true);
      else reject(error);
    });
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen({ port, host, exclusive: true });
  });
}

export async function selectDefaultPort(host = 'localhost'): Promise<number> {
  const hosts = new Set([host, '0.0.0.0', '::', '127.0.0.1', '::1']);
  candidates:
  for (const port of [3000, 8888, 4000, 5000, 6000, 7000, 8000]) {
    // Check both address families, including wildcard listeners that can coexist
    // with localhost on some systems but make the preview URL ambiguous.
    for (const address of hosts) {
      if (!await isAvailable(port, address)) continue candidates;
    }
    return port;
  }
  // Vite scans sequentially from here and handles bind-time collisions too.
  return 3001;
}
