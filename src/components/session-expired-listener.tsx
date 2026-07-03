'use client';

import { useEffect } from 'react';
import { useStytch, useStytchSession } from '@stytch/nextjs';

/** Best-effort Stytch revoke when centralized session expiry fires. */
export function SessionExpiredListener() {
  const stytch = useStytch();
  const { session } = useStytchSession();

  useEffect(() => {
    const onExpired = () => {
      if (stytch && session) {
        void stytch.session.revoke().catch(() => undefined);
      }
    };
    window.addEventListener('tensr:session-expired', onExpired);
    return () => window.removeEventListener('tensr:session-expired', onExpired);
  }, [stytch, session]);

  return null;
}
