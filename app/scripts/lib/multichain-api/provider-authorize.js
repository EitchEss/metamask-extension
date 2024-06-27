import { EthereumRpcError } from 'eth-rpc-errors';
import MetaMaskOpenRPCDocument from '@metamask/api-specs';
import { MESSAGE_TYPE } from '../../../../shared/constants/app';
import {
  isSupportedScopeString,
  isSupportedNotification,
  isValidScope,
} from './caip-25';
import {
  Caip25CaveatType,
  Caip25EndowmentPermissionName,
} from './caip25permissions';

const validRpcMethods = MetaMaskOpenRPCDocument.methods.map(({ name }) => name);

// {
//   "requiredScopes": {
//     "eip155": {
//       "scopes": ["eip155:1", "eip155:137"],
//       "methods": ["eth_sendTransaction", "eth_signTransaction", "eth_sign", "get_balance", "personal_sign"],
//       "notifications": ["accountsChanged", "chainChanged"]
//     },
//     "eip155:10": {
//       "methods": ["get_balance"],
//       "notifications": ["accountsChanged", "chainChanged"]
//     },
//     "wallet": {
//       "methods": ["wallet_getPermissions", "wallet_creds_store", "wallet_creds_verify", "wallet_creds_issue", "wallet_creds_present"],
//       "notifications": []
//     },
//     "cosmos": {
//       ...
//     }
//   },
//   "optionalScopes":{
//     "eip155:42161": {
//       "methods": ["eth_sendTransaction", "eth_signTransaction", "get_balance", "personal_sign"],
//       "notifications": ["accountsChanged", "chainChanged"]
//   },
//   "sessionProperties": {
//     "expiry": "2022-12-24T17:07:31+00:00",
//     "caip154-mandatory": "true"
//   }
// }

const providerAuthorize = {
  methodNames: [MESSAGE_TYPE.PROVIDER_AUTHORIZE],
  implementation: providerAuthorizeHandler,
  hookNames: {
    grantPermissions: true,
  },
};
export default providerAuthorize;

const paramsToArray = (params) => {
  const arr = [];
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      arr.push(params[key]);
    }
  }
  return arr;
};

async function providerAuthorizeHandler(_req, res, _next, end, hooks) {
  const [requiredScopes, optionalScopes, sessionProperties, ...restParams] =
    Array.isArray(_req.params) ? _req.params : paramsToArray(_req.params);

  if (Object.keys(restParams).length !== 0) {
    return end(
      new EthereumRpcError(
        5301,
        'Session Properties can only be optional and global',
      ),
    );
  }

  const sessionId = '0xdeadbeef';

  const validRequiredScopes = {};
  for (const [scopeString, scopeObject] of Object.entries(requiredScopes)) {
    if (isValidScope(scopeString, scopeObject)) {
      validRequiredScopes[scopeString] = {
        accounts: [],
        ...scopeObject,
      };
    }
  }
  if (requiredScopes && Object.keys(validRequiredScopes).length === 0) {
    // What error code and message here?
    throw new Error(
      '`requiredScopes` object MUST contain 1 more `scopeObjects`, if present',
    );
  }

  const validOptionalScopes = {};
  for (const [scopeString, scopeObject] of Object.entries(optionalScopes)) {
    if (isValidScope(scopeString, scopeObject)) {
      validOptionalScopes[scopeString] = {
        accounts: [],
        ...scopeObject,
      };
    }
  }
  if (optionalScopes && Object.keys(validOptionalScopes).length === 0) {
    // What error code and message here?
    throw new Error(
      '`optionalScopes` object MUST contain 1 more `scopeObjects`, if present',
    );
  }

  const randomSessionProperties = {}; // session properties do not have to be honored by the wallet
  for (const [key, value] of Object.entries(sessionProperties)) {
    if (Math.random() > 0.5) {
      randomSessionProperties[key] = value;
    }
  }
  if (sessionProperties && Object.keys(sessionProperties).length === 0) {
    return end(
      new EthereumRpcError(5300, 'Invalid Session Properties requested'),
    );
  }

  const validScopes = {
    // what happens if these keys collide?
    ...validRequiredScopes,
    ...validOptionalScopes,
  };

  // TODO:
  // Unless the dapp is known and trusted, give generic error messages for
  // - the user denies consent for exposing accounts that match the requested and approved chains,
  // - the user denies consent for requested methods,
  // - the user denies all requested or any required scope objects,
  // - the wallet cannot support all requested or any required scope objects,
  // - the requested chains are not supported by the wallet, or
  // - the requested methods are not supported by the wallet
  // return
  //     "code": 0,
  //     "message": "Unknown error"

  if (Object.keys(validScopes).length === 0) {
    return end(new EthereumRpcError(5000, 'Unknown error with request'));
  }

  // TODO:
  // When user disapproves accepting calls with the request methods
  //   code = 5001
  //   message = "User disapproved requested methods"
  // When user disapproves accepting calls with the request notifications
  //   code = 5002
  //   message = "User disapproved requested notifications"

  for (const [scopeString, scopeObject] of Object.entries(validScopes)) {
    if (!isSupportedScopeString(scopeString)) {
      // A little awkward. What is considered validation? Currently isValidScope only
      // verifies that the shape of a scopeString and scopeObject is correct, not if it
      // is supported by MetaMask and not if the scopes themselves (the chainId part) are well formed.

      // Additionally, still need to handle adding chains to the NetworkController and verifying
      // that a network client exists to handle the chainId

      // Finally, I'm unsure if this is also meant to handle the case where namespaces are not
      // supported by the wallet.

      return end(
        new EthereumRpcError(5100, 'Requested chains are not supported'),
      );
    }

    console.log('scopeObject', scopeObject);
    // Needs to be split by namespace?
    const allMethodsSupported = scopeObject.methods.every((method) =>
      validRpcMethods.includes(method),
    );
    if (!allMethodsSupported) {
      // not sure which one of these to use
      // When provider evaluates requested methods to not be supported
      //   code = 5101
      //   message = "Requested methods are not supported"
      // When provider does not recognize one or more requested method(s)
      //   code = 5201
      //   message = "Unknown method(s) requested"

      return end(
        new EthereumRpcError(5101, 'Requested methods are not supported'),
      );
    }
  }

  for (const [, scopeObject] of Object.entries(validScopes)) {
    if (!scopeObject.notifications) {
      continue;
    }
    if (!scopeObject.notifications.every(isSupportedNotification)) {
      // not sure which one of these to use
      // When provider evaluates requested notifications to not be supported
      //   code = 5102
      //   message = "Requested notifications are not supported"
      // When provider does not recognize one or more requested notification(s)
      //   code = 5202
      //   message = "Unknown notification(s) requested"
      return end(
        new EthereumRpcError(5102, 'Requested notifications are not supported'),
      );
    }
  }

  hooks.grantPermissions({
    subject: {
      origin: _req.origin,
    },
    approvedPermissions: {
      [Caip25EndowmentPermissionName]: {
        caveats: [
          {
            type: Caip25CaveatType,
            value: {
              requiredScopes: validRequiredScopes,
              optionalScopes: validOptionalScopes,
            },
          },
        ],
      },
    },
  });

  res.result = {
    sessionId,
    sessionScopes: validScopes,
    sessionProperties: randomSessionProperties,
  };
  return end();
}