import { ethers, network } from 'hardhat';
import { AztecAsset, AztecAssetType } from '../bridge-data';
import { StakingBridgeData } from './staking-bridge-data';

describe('staking bridge data', () => {
  let rollupProcessorAddr: string;
  let stakingBridgeData: StakingBridgeData;

  let emptyAsset: AztecAsset;
  let lqtyAsset: AztecAsset;
  let sbAsset: AztecAsset;

  beforeAll(async () => {
    rollupProcessorAddr = ethers.Wallet.createRandom().address;

    const signer = (await ethers.getSigners())[0];
    await network.provider.send('hardhat_setBalance', [signer.address, '0xFFFFFFFFFFFFFFFFFFFFFFFFFF']);

    const StakingBridge = await ethers.getContractFactory('StakingBridge');
    let stakingBridge = await StakingBridge.deploy(rollupProcessorAddr);
    await stakingBridge.deployed();

    stakingBridgeData = new StakingBridgeData(stakingBridge);

    emptyAsset = {
      id: 0n,
      assetType: AztecAssetType.NOT_USED,
      erc20Address: '0x0000000000000000000000000000000000000000',
    };
    lqtyAsset = {
      id: 1n,
      assetType: AztecAssetType.ERC20,
      erc20Address: '0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D',
    };
    sbAsset = {
      id: 2n,
      assetType: AztecAssetType.ERC20,
      erc20Address: stakingBridge.address,
    };
  }, 60000);

  it('should return bigger output than input after a year of staking', async () => {
    const inputValue = 100000000000000000000n; // 1e20 --> 100 LQTY
    const [outputValueA, outputValueB] = await stakingBridgeData.getExpectedYearlyOuput(
      lqtyAsset,
      emptyAsset,
      sbAsset,
      emptyAsset,
      0n,
      inputValue,
    );

    expect(outputValueA).toBeGreaterThan(inputValue);
    expect(outputValueB).toBe(0n);
  });

  it('should return non-zero market size', async () => {
    const [assetValueA] = await stakingBridgeData.getMarketSize(
      lqtyAsset,
      emptyAsset,
      sbAsset,
      emptyAsset,
      0n,
    );

    expect(assetValueA.amount).toBeGreaterThan(0n);
  });
});
