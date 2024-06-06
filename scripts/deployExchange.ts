import { toNano, Address } from '@ton/core';
import { main } from '../wrappers/Exchange';
import { NetworkProvider } from '@ton/blueprint';
import { buildOnchainMetadata } from "../utils/jetton-helpers";
import fs from 'fs';

export async function run(provider: NetworkProvider) {
    let rawdata = fs.readFileSync('JettonAddress.json');
    const jettonAddress = Address.parse(JSON.parse(rawdata.toString()));

    const owner = provider.sender().address as Address;
    const exchange = provider.open(await main.fromInit(jettonAddress, owner));

    await exchange.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(exchange.address);
    // console.log('Exchange deployed at', exchange.address.toString());

    // run methods on `exchange`
}
