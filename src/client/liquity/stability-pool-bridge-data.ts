import { ethers } from 'hardhat';
import { StabilityPoolBridge } from '../../../typechain-types';
import {
  AssetValue,
  AuxDataConfig,
  AztecAsset,
  SolidityType, YieldBridgeData
} from '../bridge-data';
import { getLusdApr } from './utils/lusd-apr';


export class StabilityPoolBridgeData implements YieldBridgeData {
  private lusdAddress = '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0';

  private stabilityPoolBridge: StabilityPoolBridge;

  constructor(stabilityPoolBridge: StabilityPoolBridge) {
    this.stabilityPoolBridge = stabilityPoolBridge;
  }

  // @dev This function should be implemented for stateful bridges. It should return an array of AssetValue's
  // @dev which define how much a given interaction is worth in terms of Aztec asset ids.
  // @param bigint interactionNonce the interaction nonce to return the value for

  async getInteractionPresentValue(interactionNonce: bigint): Promise<AssetValue[]> {
    return [
      {
        assetId: 1n,
        amount: 1000n,
      },
    ];
  }

  async getAuxData(
    inputAssetA: AztecAsset,
    inputAssetB: AztecAsset,
    outputAssetA: AztecAsset,
    outputAssetB: AztecAsset,
  ): Promise<bigint[]> {
    return [0n];
  }

  public auxDataConfig: AuxDataConfig[] = [
    {
      start: 0,
      length: 64,
      solidityType: SolidityType.uint64,
      description: 'Not Used',
    },
  ];

  async getExpectedOutput(
    inputAssetA: AztecAsset,
    inputAssetB: AztecAsset,
    outputAssetA: AztecAsset,
    outputAssetB: AztecAsset,
    auxData: bigint,
    inputValue: bigint,
  ): Promise<bigint[]> {
    return [100n, 0n];
  }

  // @notice: computes expected yearly output based on LQTY rewarded to the stability pool
  // and amount of LUSD deposited. Gains from ETH liquidations are not considered because
  // of unpredictability
  async getExpectedYearlyOuput(
    inputAssetA: AztecAsset,
    inputAssetB: AztecAsset,
    outputAssetA: AztecAsset,
    outputAssetB: AztecAsset,
    auxData: bigint,
    inputValue: bigint,
  ): Promise<bigint[]> {
    const apr = await getLusdApr();
    const outputValue: bigint = inputValue + BigInt(Number(inputValue) * apr);
    return [outputValue, 0n];
  }

  // @notice: returns the amount of lusd deposited to the StabilityPool.sol
  async getMarketSize(
    inputAssetA: AztecAsset,
    inputAssetB: AztecAsset,
    outputAssetA: AztecAsset,
    outputAssetB: AztecAsset,
    auxData: bigint,
  ): Promise<AssetValue[]> {
    const ERC20 = await ethers.getContractAt('ERC20', this.lusdAddress);
    const stabilityPoolContract = '0x66017D22b0f8556afDd19FC67041899Eb65a21bb';
    const lusdAmount = (await ERC20.balanceOf(stabilityPoolContract)).toBigInt();
    return [{ assetId: 0n, amount: lusdAmount }];
  }
}
