/**
 * src/services/passkeyClient.js
 *
 * Phase 3: WebAuthn passkey client replacing legacy src/utils/biometrics.js.
 *
 * - Passkeys require a secure context (HTTPS or localhost). On plain HTTP
 *   (e.g., Pi kiosk over LAN), isPasskeySupported() returns false so the UI
 *   shows the PIN tab only.
 * - Registration: passkeyRegisterBegin -> navigator.credentials.create -> passkeyRegisterFinish
 * - Authentication: passkeyAuthBegin -> navigator.credentials.get -> passkeyAuthFinish
 */

import { ledgerClient } from './ledgerClient.js';

function _base64UrlToBuffer(base64url) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes.buffer;
}

function _bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isPasskeySupported() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const isSecure = Boolean(
    window.isSecureContext ||
    window.location?.protocol === 'https:' ||
    window.location?.hostname === 'localhost' ||
    window.location?.hostname === '127.0.0.1'
  );
  if (!isSecure) return false;
  return Boolean(window.PublicKeyCredential && navigator.credentials && typeof navigator.credentials.get === 'function');
}

export async function isPlatformPasskeyAvailable() {
  if (!isPasskeySupported()) return false;
  try {
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

function _rpContext() {
  const rpId = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
  return { rpId, origin };
}

export async function registerPasskey(label = 'Parent Device') {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys require HTTPS on this device.');
  }
  const { rpId, origin } = _rpContext();
  const beginRes = await ledgerClient.run('passkeyRegisterBegin', { rpId, origin }, { queueOnNetworkError: false });
  const options = beginRes?.options;
  if (!options) throw new Error('Could not start passkey registration.');

  const publicKey = {
    ...options,
    challenge: _base64UrlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: _base64UrlToBuffer(options.user.id)
    },
    excludeCredentials: (options.excludeCredentials || []).map((c) => ({
      ...c,
      id: _base64UrlToBuffer(c.id)
    }))
  };

  const credential = await navigator.credentials.create({ publicKey });
  if (!credential) throw new Error('Passkey creation was cancelled.');

  const response = {
    id: credential.id,
    rawId: _bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: _bufferToBase64Url(credential.response.clientDataJSON),
      attestationObject: _bufferToBase64Url(credential.response.attestationObject),
      transports: typeof credential.response.getTransports === 'function' ? credential.response.getTransports() : undefined
    },
    clientExtensionResults: typeof credential.getClientExtensionResults === 'function' ? credential.getClientExtensionResults() : {}
  };

  return await ledgerClient.run('passkeyRegisterFinish', { rpId, origin, label, response }, { queueOnNetworkError: false });
}

export async function authenticateWithPasskey() {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys require HTTPS on this device.');
  }
  const { rpId, origin } = _rpContext();
  const beginRes = await ledgerClient.run('passkeyAuthBegin', { rpId, origin }, { queueOnNetworkError: false });
  const options = beginRes?.options;
  if (!options) throw new Error('No passkeys registered for this address.');

  const publicKey = {
    ...options,
    challenge: _base64UrlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((c) => ({
      ...c,
      id: _base64UrlToBuffer(c.id)
    }))
  };

  const credential = await navigator.credentials.get({ publicKey });
  if (!credential) throw new Error('Fingerprint scan was cancelled.');

  const response = {
    id: credential.id,
    rawId: _bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: _bufferToBase64Url(credential.response.clientDataJSON),
      authenticatorData: _bufferToBase64Url(credential.response.authenticatorData),
      signature: _bufferToBase64Url(credential.response.signature),
      userHandle: credential.response.userHandle ? _bufferToBase64Url(credential.response.userHandle) : null
    },
    clientExtensionResults: typeof credential.getClientExtensionResults === 'function' ? credential.getClientExtensionResults() : {}
  };

  return await ledgerClient.run('passkeyAuthFinish', { rpId, origin, response }, { queueOnNetworkError: false });
}

export async function removePasskey(credentialId) {
  return await ledgerClient.run('removePasskey', { credentialId }, { queueOnNetworkError: false });
}
