import { ethers, network } from 'hardhat';
import { AztecAsset, AztecAssetType } from '../bridge-data';
import { StabilityPoolBridgeData } from './stability-pool-bridge-data';

describe('stability pool bridge data', () => {
  let rollupProcessorAddr: string;
  let stabilityPoolBridgeData: StabilityPoolBridgeData;

  let emptyAsset: AztecAsset;
  let lusdAsset: AztecAsset;
  let spbAsset: AztecAsset;

  beforeAll(async () => {
    rollupProcessorAddr = ethers.Wallet.createRandom().address;

    const signer = (await ethers.getSigners())[0];
    await network.provider.send('hardhat_setBalance', [signer.address, '0xFFFFFFFFFFFFFFFFFFFFFFFFFF']);

    const StabilityPoolBridge = await ethers.getContractFactory('StabilityPoolBridge');
    let stabilityPoolBridge = await StabilityPoolBridge.deploy(
      rollupProcessorAddr,
      '0x0000000000000000000000000000000000000000',
    );
    await stabilityPoolBridge.deployed();

    stabilityPoolBridgeData = new StabilityPoolBridgeData(stabilityPoolBridge);

    emptyAsset = {
      id: 0n,
      assetType: AztecAssetType.NOT_USED,
      erc20Address: '0x0000000000000000000000000000000000000000',
    };
    lusdAsset = {
      id: 1n,
      assetType: AztecAssetType.ERC20,
      erc20Address: '0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D',
    };
    spbAsset = {
      id: 2n,
      assetType: AztecAssetType.ERC20,
      erc20Address: stabilityPoolBridge.address,
    };
  }, 60000);

  it('should return bigger output than input after a year of staking', async () => {
    const inputValue = 100000000000000000000n; // 1e20 --> 100 LUSD
    const [outputValueA, outputValueB] = await stabilityPoolBridgeData.getExpectedYearlyOuput(
      lusdAsset,
      emptyAsset,
      spbAsset,
      emptyAsset,
      0n,
      inputValue,
    );

    expect(outputValueA).toBeGreaterThan(inputValue);
    expect(outputValueB).toBe(0n);
  });

  it('should return non-zero market size', async () => {
    const [assetValueA] = await stabilityPoolBridgeData.getMarketSize(lusdAsset, emptyAsset, spbAsset, emptyAsset, 0n);

    expect(assetValueA.amount).toBeGreaterThan(0n);
  });
});
