import { CallOverrides } from 'ethers';
import { ethers } from 'hardhat';
import { StakingBridge } from '../../../typechain-types';
import {
  AssetValue,
  AuxDataConfig,
  AztecAsset, AztecAssetType, SolidityType, YieldBridgeData
} from '../bridge-data';
import { getLqtyApr } from './utils/lqty-apr';


export class StakingBridgeData implements YieldBridgeData {
  private lqtyAddress = '0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D';

  private stakingBridge: StakingBridge;

  constructor(stakingBridge: StakingBridge) {
    this.stakingBridge = stakingBridge;
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
    let overrides: CallOverrides = { from: await this.stakingBridge.processor() };

    if (inputAssetA.erc20Address == this.lqtyAddress && outputAssetA.erc20Address == this.stakingBridge.address) {
      // LQTY -> SB (StakingBridge token)
      let [outputValueA, _] = await this.stakingBridge.callStatic.convert(
        inputAssetA,
        inputAssetB,
        outputAssetA,
        outputAssetB,
        inputValue,
        '0',
        '0',
        '0x0000000000000000000000000000000000000000',
        overrides,
      );
      return [outputValueA.toBigInt(), 0n];
    } else if (inputAssetA.erc20Address == this.stakingBridge.address && outputAssetA.assetType == AztecAssetType.ETH) {
      // SB -> LQTY
    }

    return [100n, 0n];
  }

  async getExpectedYearlyOuput(
    inputAssetA: AztecAsset,
    inputAssetB: AztecAsset,
    outputAssetA: AztecAsset,
    outputAssetB: AztecAsset,
    auxData: bigint,
    inputValue: bigint,
  ): Promise<bigint[]> {
    const apr = await getLqtyApr();
    const outputValue: bigint = inputValue + BigInt(Number(inputValue) * apr);
    return [outputValue, 0n];
  }

  // @notice: returns the amount of lqty staked
  async getMarketSize(
    inputAssetA: AztecAsset,
    inputAssetB: AztecAsset,
    outputAssetA: AztecAsset,
    outputAssetB: AztecAsset,
    auxData: bigint,
  ): Promise<AssetValue[]> {
    const ERC20 = await ethers.getContractAt('ERC20', this.lqtyAddress);
    const stakingContract = '0x4f9Fbb3f1E99B56e0Fe2892e623Ed36A76Fc605d';
    const lqtyAmount = (await ERC20.balanceOf(stakingContract)).toBigInt();
    return [{ assetId: 0n, amount: lqtyAmount }];
  }
}
