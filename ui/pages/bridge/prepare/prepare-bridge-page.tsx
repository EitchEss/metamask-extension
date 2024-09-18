import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setFromToken,
  setFromTokenInputValue,
  setToChain,
  setToToken,
  switchToAndFromInputs,
} from '../../../ducks/bridge/actions';
import {
  getFromAmount,
  getFromChain,
  getFromChains,
  getFromToken,
  getFromTokens,
  getFromTopAssets,
  getQuoteRequest,
  getToAmount,
  getToChain,
  getToChains,
  getToToken,
  getToTokens,
  getToTopAssets,
} from '../../../ducks/bridge/selectors';
import {
  Box,
  ButtonIcon,
  IconName,
} from '../../../components/component-library';
import { BlockSize } from '../../../helpers/constants/design-system';
import { useI18nContext } from '../../../hooks/useI18nContext';
import { TokenBucketPriority } from '../../../../shared/constants/swaps';
import { useTokensWithFiltering } from '../../../hooks/useTokensWithFiltering';
import { setActiveNetwork } from '../../../store/actions';
import { BridgeQuoteCard } from '../quotes/bridge-quote-card';
import { BridgeInputGroup } from './bridge-input-group';

const PrepareBridgePage = () => {
  const dispatch = useDispatch();

  const t = useI18nContext();

  const fromToken = useSelector(getFromToken);
  const fromTokens = useSelector(getFromTokens);
  const fromTopAssets = useSelector(getFromTopAssets);

  const toToken = useSelector(getToToken);
  const toTokens = useSelector(getToTokens);
  const toTopAssets = useSelector(getToTopAssets);

  const fromChains = useSelector(getFromChains);
  const toChains = useSelector(getToChains);
  const fromChain = useSelector(getFromChain);
  const toChain = useSelector(getToChain);

  const fromAmount = useSelector(getFromAmount);
  const toAmount = useSelector(getToAmount);

  const { isValid: isQuoteRequestValid } = useSelector(getQuoteRequest);

  const fromTokenListGenerator = useTokensWithFiltering(
    fromTokens,
    fromTopAssets,

    TokenBucketPriority.owned,
    fromChain?.chainId,
  );
  const toTokenListGenerator = useTokensWithFiltering(
    toTokens, // ?? fromTokens,
    toTopAssets, // ?? fromTopAssets,

    TokenBucketPriority.top,
    toChain?.chainId, // ?? fromChain?.chainId,
  );

  return (
    <div className="prepare-bridge-page">
      <Box className="prepare-bridge-page__content">
        <BridgeInputGroup
          className="bridge-box"
          header={t('bridgeFrom')}
          asset={{
            ...fromToken,
            image: 'iconUrl' in fromToken ? fromToken?.iconUrl : null,
          }}
          onAmountChange={(e) => {
            dispatch(
              setFromTokenInputValue({
                amount: e,
                decimals: Number(fromToken.decimals),
              }),
            );
          }}
          onAssetChange={(token) => dispatch(setFromToken(token))}
          networkProps={{
            network: fromChain,
            networks: fromChains,
            onNetworkChange: (networkConfig) => {
              if (networkConfig.id) {
                dispatch(setActiveNetwork(networkConfig.id));
                // dispatch(setFromChain(networkConfig.chainId));
              }
              // TODO emit metric
            },
          }}
          customTokenListGenerator={
            fromTokens && fromTopAssets ? fromTokenListGenerator : undefined
          }
          amountFieldProps={{
            testId: 'from-amount',
            autoFocus: true,
            value: fromAmount,
          }}
        />

        <Box className="prepare-bridge-page__switch-tokens">
          <ButtonIcon
            width={BlockSize.Full}
            data-testid="switch-tokens"
            ariaLabel="switch-tokens"
            iconName={IconName.Arrow2Down}
            disabled={!isQuoteRequestValid}
            onClick={() => {
              // TODO rotate animation
              toChain?.id && dispatch(setActiveNetwork(toChain.id));
              dispatch(switchToAndFromInputs(fromChain.chainId));
            }}
          />
        </Box>

        <BridgeInputGroup
          className="bridge-box"
          header={t('bridgeTo')}
          asset={toToken}
          onAssetChange={(token) => dispatch(setToToken(token))}
          networkProps={{
            network: toChain,
            networks: toChains,
            onNetworkChange: (networkConfig) => {
              dispatch(setToChain(networkConfig.chainId));
            },
          }}
          customTokenListGenerator={
            toChain && toTokens && toTopAssets
              ? toTokenListGenerator
              : fromTokenListGenerator
          }
          amountFieldProps={{
            testId: 'to-amount',
            readOnly: true,
            disabled: true,
            value: toAmount ?? '0',
            className: toAmount ? 'amount-input defined' : 'amount-input',
          }}
        />
      </Box>

      <BridgeQuoteCard />
    </div>
  );
};

export default PrepareBridgePage;
