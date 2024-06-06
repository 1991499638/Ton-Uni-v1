import { toNano, Address } from '@ton/core';
import { main } from '../wrappers/Exchange';
import { NetworkProvider } from '@ton/blueprint';
import { buildOnchainMetadata } from "../utils/jetton-helpers";
import fs from 'fs';

const jettonParams = {
    name: "LP token",
    description: "This is the first jetton from the test suite",
    symbol: "LP",
    image: "https://avatars.githubusercontent.com/u/115602512?s=96&v=4",
};

export async function run(provider: NetworkProvider) {
    let rawdata = fs.readFileSync('JettonAddress.json');
    const jettonAddress = Address.parse(JSON.parse(rawdata.toString()));

    const owner = provider.sender().address as Address;
    const exchange = provider.open(await main.fromInit(jettonAddress, owner));

    let content = buildOnchainMetadata(jettonParams);

    await exchange.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'TokenUpdateContent',
            content: content,
        }
    );

    await provider.waitForDeploy(exchange.address);

    // run methods on `exchange`
}
