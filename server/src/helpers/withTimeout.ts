export class TimeoutSentinel {
  constructor(public readonly tag: string) {}
}

export function isTimeoutSentinel(err: unknown, tag: string): err is TimeoutSentinel {
  return err instanceof TimeoutSentinel && err.tag === tag;
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, tag: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutSentinel(tag)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
