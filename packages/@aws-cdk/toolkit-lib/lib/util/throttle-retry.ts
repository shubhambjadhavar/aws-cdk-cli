/**
 * Whether an error represents a CloudFormation/AWS API throttling response.
 *
 * The SDK client's own `ConfiguredRetryStrategy` already retries throttling errors a bounded
 * number of times (see `Sdk.cloudFormation()`), but that budget can run out during a large,
 * highly-parallel deploy where many stacks hit the CloudFormation API at once. This is a second,
 * unbounded retry layer for exactly that error class - it never retries anything else.
 */
export function isThrottlingError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    const e = current as { name?: string; Code?: string; cause?: unknown } | undefined;
    if (e?.name === 'Throttling' || e?.name === 'ThrottlingException' || e?.Code === 'Throttling') {
      return true;
    }
    current = e?.cause;
  }
  return false;
}

/**
 * Retry `operation` indefinitely while it fails with a throttling error, waiting `delayMs`
 * between attempts. Any other error is rethrown immediately without retrying.
 */
export async function withThrottleRetry<T>(operation: () => Promise<T>, delayMs = 1000): Promise<T> {
  while (true) {
    try {
      return await operation();
    } catch (err) {
      if (!isThrottlingError(err)) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
