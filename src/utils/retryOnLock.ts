export async function retryOnLock<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 750
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const msg = error?.message || error?.error || '';
      if (msg.includes('currently being modified') && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
