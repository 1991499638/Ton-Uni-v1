import { toNano, Address, beginCell,  } from '@ton/core';
import { main } from '../wrappers/Exchange';
import { JettonDefaultWallet as JettonWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';
import { NetworkProvider } from '@ton/blueprint';
import fs from 'fs';

export async function run(provider: NetworkProvider) {
    let rawdata = fs.readFileSync('JettonAddress.json');
    const jettonAddress = Address.parse(JSON.parse(rawdata.toString()));
    const user = provider.sender().address as Address;

    const exchange = provider.open(await main.fromInit(jettonAddress, user));
    const jettonWallet = provider.open(await JettonWallet.fromInit(jettonAddress, user));
    
    let tonAmount = toNano(1);
    let jettonAmount = toNano(1000);
    await jettonWallet.send(
        provider.sender(),
        {
            value: toNano('0.1') + tonAmount,
            bounce: true,

        },
        {
            $$type: "TokenTransfer",
            queryId: 1n,
            amount: jettonAmount,
            destination: exchange.address,
            response_destination: user,
            custom_payload: cell("first add"),
            forward_ton_amount: tonAmount,
            forward_payload: cell("addLiqudity"),
        }
    );

    await provider.waitForDeploy(jettonWallet.address);

    // run methods on `exchange`
}

function cell(pram: string) {
    return beginCell().storeBit(1).storeUint(0, 32).storeStringTail(pram).endCell();
}