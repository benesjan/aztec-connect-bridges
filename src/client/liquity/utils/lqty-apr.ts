// code based on https://github.com/KnowYourDeFi/knowyourdefi.github.io/blob/master/frontend/src/liquity/charts/LqtyAPR.js
import 'cross-fetch/polyfill';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const liquityClient = new ApolloClient({
  uri: 'https://api.thegraph.com/subgraphs/name/liquity/liquity',
  cache: new InMemoryCache(),
});

const uniV2Client = new ApolloClient({
  uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
  cache: new InMemoryCache(),
});

const blockClient = new ApolloClient({
  uri: 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
  cache: new InMemoryCache(),
});

export async function query(ql: any, client = liquityClient) {
  let data = await client.query({
    query: gql(ql),
    fetchPolicy: 'cache-first',
  });
  data = data && data.data;
  // trace('query:', ql, 'result:', data)
  return data;
}

export async function splitQuery(queryGenerator: any, client: any, vars: any, list: any, skipCount = 100) {
  let fetchedData = {};
  let allFound = false;
  let skip = 0;

  while (!allFound) {
    let end = list.length;
    if (skip + skipCount < list.length) {
      end = skip + skipCount;
    }
    let sliced = list.slice(skip, end);
    let result = await client.query({
      query: gql(queryGenerator(...vars, sliced)),
      fetchPolicy: 'cache-first',
    });
    fetchedData = {
      ...fetchedData,
      ...result.data,
    };
    if (Object.keys(result.data).length < skipCount || skip + skipCount > list.length) {
      allFound = true;
    } else {
      skip += skipCount;
    }
  }

  return fetchedData;
}

async function getBlocksFromTimestamps(timestamps: any, skipCount = 500) {
  if (timestamps?.length === 0) {
    return [];
  }

  let fetchedData: any = await splitQuery(getBlocksQuery, blockClient, [], timestamps, skipCount);

  let blocks = [];
  if (fetchedData) {
    for (var t in fetchedData) {
      if (fetchedData[t].length > 0) {
        blocks.push({
          timestamp: t.split('t')[1],
          number: fetchedData[t][0]['number'],
        });
      }
    }
  }
  return blocks;
}

function getBlocksQuery(timestamps: any) {
  let queryString = 'query blocks {';
  queryString += timestamps.map((timestamp: any) => {
    return `t${timestamp}:blocks(first: 1, orderBy: timestamp, orderDirection: desc, where: { timestamp_gt: ${timestamp}, timestamp_lt: ${
      timestamp + 600
    } }) {
      number
    }`;
  });
  queryString += '}';
  return queryString;
}

export async function getEthAndLqtyPrices() {
  const gql = `
    {
        pair(id:"0xb13201b48b1e61593df055576964d0b3aab66ea3")
        {
          token1Price
        }
        bundle(id: "1" ) {
            ethPrice
        }
    }
    `;
  //Get Uniswap V2 price
  let data = await query(gql, uniV2Client);
  // @ts-ignore
  const ethPrice = parseFloat(data.bundle.ethPrice);
  // @ts-ignore
  const tokenPriceInEth = data.pair.token1Price;
  const lqtyPrice = ethPrice * tokenPriceInEth;
  return [ethPrice, lqtyPrice];
}

//Get blocks for now and 7 days ago
async function getBlocks() {
  // While testing, we found the latest block may not yet be indexed by Liquity, so getting earlier block
  let now = dayjs().utc().unix() - 1200;
  let weekAgo = now - 7 * 24 * 3600;
  let blocks = await getBlocksFromTimestamps([weekAgo, now]);
  return blocks;
}

async function getLiquityInfo(blocks: any) {
  //Query for Liquity info
  let gql = 'query blocks {';
  gql += blocks.map(
    (block: any) => `
      t${block.timestamp}: global(id:"only", block: { number: ${block.number} }) {
          totalRedemptionFeesPaid
          totalBorrowingFeesPaid
          currentSystemState {
            totalLQTYTokensStaked
          }
      }
    `,
  );
  gql += '}';

  const data: any = await query(gql);

  // format result
  let values = [];
  for (var row in data) {
    let timestamp = row.split('t')[1];
    let totalRedemptionFeesPaid = parseFloat(data[row]?.totalRedemptionFeesPaid);
    let totalBorrowingFeesPaid = parseFloat(data[row]?.totalBorrowingFeesPaid);
    let totalLQTYTokensStaked = parseFloat(data[row]?.currentSystemState.totalLQTYTokensStaked);
    if (timestamp) {
      values.push({
        timestamp,
        totalRedemptionFeesPaid,
        totalBorrowingFeesPaid,
        totalLQTYTokensStaked,
      });
    }
  }
  //Sort values
  values.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

  return values;
}

export async function getLqtyApr(): Promise<number> {
  const blockPromise = getBlocks();
  const ethLqtyPricePromise = getEthAndLqtyPrices();
  const liquityInfo = await getLiquityInfo(await blockPromise);

  const borrowFeeDiff = liquityInfo[1].totalBorrowingFeesPaid - liquityInfo[0].totalBorrowingFeesPaid;
  const redemptionFeeDiff = liquityInfo[1].totalRedemptionFeesPaid - liquityInfo[0].totalRedemptionFeesPaid;
  const [ethPrice, lqtyPrice] = await ethLqtyPricePromise;
  return (
    ((borrowFeeDiff + redemptionFeeDiff * ethPrice) / (liquityInfo[1].totalLQTYTokensStaked * lqtyPrice) / 7) * 365
  );
}
