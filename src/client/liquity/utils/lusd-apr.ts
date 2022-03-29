// Code based on https://github.com/KnowYourDeFi/knowyourdefi.github.io/blob/master/frontend/src/liquity/charts/LusdAPR.js
import { getEthAndLqtyPrices, query } from './lqty-apr';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

async function getLusdDeposited(): Promise<number> {
  const gql = `
    {
      global(id: "only") {
        currentSystemState {
            tokensInStabilityPool
          }
        }
    }
    `;
  const data: any = await query(gql);
  return Number(data.global.currentSystemState.tokensInStabilityPool);
}

function calculateAPR(depositedLUSD: number, lqtyPrice: number) {
  const issuanceFactor = 0.999998681227695;
  const deploymenttime = 1617611537;
  const lqtysupplycap = 32000000;

  const minutesPassed = (dayjs().utc().unix() - deploymenttime) / 60;
  const factor = Math.pow(issuanceFactor, minutesPassed);
  const lqtyRewards = lqtysupplycap * factor;

  const years = dayjs().year() - 2020;
  const yearlyDistribution = 1 - Math.pow(0.5, years);
  return (lqtyRewards * lqtyPrice * yearlyDistribution) / depositedLUSD;
}

export async function getLusdApr() {
  const lusdDepositedPromise = getLusdDeposited();
  const [, lqtyPrice] = await getEthAndLqtyPrices();
  return calculateAPR(await lusdDepositedPromise, lqtyPrice);
}
