import { useEffect, useState } from "react";

import type { PanelEnvironment } from "./environment";

/**
 * One value from the environment, read again whenever it changes. `undefined` means still
 * loading, which is different from `null`, meaning nothing is there.
 */
export function useEnvironmentValue<T>(
  environment: PanelEnvironment,
  read: (environment: PanelEnvironment) => Promise<T>,
): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let isCurrent = true;

    const refresh = () => {
      void read(environment).then((next) => {
        if (isCurrent) {
          setValue(next);
        }
      });
    };

    refresh();
    const stop = environment.onChange(refresh);

    return () => {
      isCurrent = false;
      stop();
    };
  }, [environment, read]);

  return value;
}

export const readToken = (environment: PanelEnvironment) => environment.readToken();
export const readPending = (environment: PanelEnvironment) => environment.readPending();
