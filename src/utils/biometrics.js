// WebAuthn Biometric Authentication Engine (Windows Hello, Touch ID, Face ID, Android Biometrics)

export async function isBiometricsAvailable() {
  try {
    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (e) {
    console.warn('Biometrics check error:', e);
  }
  return false;
}

export async function authenticateWithBiometrics(rpName = 'Little Hero Adventures') {
  if (!window.PublicKeyCredential) {
    throw new Error('Biometric authentication is not supported on this device/browser.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  // If a credential was previously registered, try to get assertion
  const savedCredId = localStorage.getItem('little_heroes_biometric_credential_id');

  if (savedCredId) {
    try {
      const rawId = Uint8Array.from(atob(savedCredId), (c) => c.charCodeAt(0));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          rpId: window.location.hostname,
          userVerification: 'required',
          allowCredentials: [
            {
              id: rawId,
              type: 'public-key',
              transports: ['internal']
            }
          ]
        }
      });
      if (assertion) {
        return { success: true, method: 'existing_biometric' };
      }
    } catch (err) {
      console.warn('Biometric assertion failed or cancelled, trying registration or error fallback:', err);
      // If user deliberately cancelled, throw so UI knows
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        throw new Error('Biometric verification cancelled.');
      }
    }
  }

  // Create new biometric registration
  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(userId);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: rpName,
        id: window.location.hostname
      },
      user: {
        id: userId,
        name: 'parent_admin',
        displayName: 'Parent Guardian'
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    }
  });

  if (credential && credential.rawId) {
    const credIdString = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    localStorage.setItem('little_heroes_biometric_credential_id', credIdString);
    return { success: true, method: 'new_biometric' };
  }

  throw new Error('Biometric verification could not be completed.');
}
