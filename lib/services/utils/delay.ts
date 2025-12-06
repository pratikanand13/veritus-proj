/**
 * Delay utility for async operations (e.g., polling)
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export default function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

