import { toNano, Address } from '@ton/core';
import { main } from '../wrappers/Exchange';
import { NetworkProvider } from '@ton/blueprint';
import { SampleJetton } from '../build/SampleJetton/tact_SampleJetton';
import { buildOnchainMetadata } from "../utils/jetton-helpers";
import fs from 'fs';

const jettonParams = {
    name: "test jetton",
    description: "This is the first jetton from the test suite",
    symbol: "TJ",
    image: "https://avatars.githubusercontent.com/u/115602512?s=96&v=4",
};

export async function run(provider: NetworkProvider) {
    const deployer = provider.sender().address as Address;
    

    // Create content Cell
    let content = buildOnchainMetadata(jettonParams);
    let max_supply = toNano(123456766689011);

    const sampleJetton = provider.open(await SampleJetton.fromInit(deployer, content, max_supply));

    // await sampleJetton.send(
    //     provider.sender(),
    //     {
    //         value: toNano('0.05'),
    //     },
    //     {
    //         $$type: 'Deploy',
    //         queryId: 0n,
    //     }
    // );

    const amount = toNano('1000000');
    await sampleJetton.send(
        provider.sender(),
        {
            value: toNano('0.5'),
        },
        {
            $$type: 'Mint',
            amount: amount,
            receiver: deployer,
        }
    );

    await provider.waitForDeploy(sampleJetton.address);
    let data = JSON.stringify(sampleJetton.address.toString());
    fs.writeFileSync('JettonAddress.json', data);

    // run methods on `exchange`
}
