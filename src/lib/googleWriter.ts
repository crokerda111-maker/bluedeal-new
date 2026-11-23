import "server-only";

import * as oidc from "openid-client";
import { memberConfig } from "./memberWrite";

export { authorizationCodeGrant, buildAuthorizationUrl, calculatePKCECodeChallenge, randomNonce, randomPKCECodeVerifier, randomState } from "openid-client";

let discovery: Promise<oidc.Configuration> | undefined;

export function googleWriter() {
  const { clientId, secret } = memberConfig();
  discovery ??= oidc.discovery(new URL("https://accounts.google.com"), clientId, secret, undefined, {
    execute: [oidc.enableNonRepudiationChecks],
    timeout: 8,
  }).catch(error => {
    discovery = undefined;
    throw error;
  });
  return discovery;
}
