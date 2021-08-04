export type SideEffectFn = (...args: any[]) => void;

export type Options = {
  isImmediate?: boolean;
  maxWait?: number;
};

export interface DebouncedFunction<F extends SideEffectFn> {
  (this: ThisParameterType<F>, ...args: Parameters<F>): void;
  cancel: () => void;
}

export function debounce<F extends SideEffectFn>(
  func: F,
  waitMilliseconds = 50,
  options: Options = {}
): DebouncedFunction<F> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const isImmediate = options.isImmediate ?? false;
  const { maxWait } = options;
  let lastInvokeTime = Date.now();

  function nextInvokeTimeout() {
    if (maxWait !== undefined) {
      const timeSinceLastInvocation = Date.now() - lastInvokeTime;

      if (timeSinceLastInvocation + waitMilliseconds >= maxWait) {
        return maxWait - timeSinceLastInvocation;
      }
    }

    return waitMilliseconds;
  }

  // eslint-disable-next-line func-names
  const debouncedFunction = function (this: ThisParameterType<F>, ...args: Parameters<F>) {
    const invokeFunction = () => {
      timeoutId = undefined;
      lastInvokeTime = Date.now();
      if (!isImmediate) {
        func.apply(this, args);
      }
    };

    const shouldCallNow = isImmediate && timeoutId === undefined;

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(invokeFunction, nextInvokeTimeout());

    if (shouldCallNow) {
      func.apply(this, args);
    }
  };

  debouncedFunction.cancel = function cancel() {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  };

  return debouncedFunction;
}

export const once = <A extends any[], R, T>(
  fn: (this: T, ...arg: A) => R
): ((this: T, ...arg: A) => R | undefined) => {
  let done = false;
  // eslint-disable-next-line func-names
  return function (this: T, ...args: A) {
    // eslint-disable-next-line no-return-assign
    return done ? undefined : ((done = true), fn.apply(this, args));
  };
};
