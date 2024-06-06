import { toNano, Address, beginCell,  } from '@ton/core';
import { main } from '../wrappers/Exchange';
import { JettonDefaultWallet as LPWallet } from '../build/Exchange/tact_JettonDefaultWallet';
import { NetworkProvider } from '@ton/blueprint';
import fs from 'fs';

export async function run(provider: NetworkProvider) {
    let rawdata = fs.readFileSync('JettonAddress.json');
    const jettonAddress = Address.parse(JSON.parse(rawdata.toString()));
    const user = provider.sender().address as Address;

    const exchange = provider.open(await main.fromInit(jettonAddress, user));
    const lpWallet = provider.open(await LPWallet.fromInit(exchange.address, user));

    let tonAmount = toNano(0.05);
    let lpAmount = toNano(0.25);
    await lpWallet.send(
        provider.sender(),
        {
            value: toNano('0.1') + tonAmount,
        },
        {
            $$type: "TokenTransfer",
            queryId: 1n,
            amount: lpAmount,
            destination: exchange.address,
            response_destination: user,
            custom_payload: cell("removeLiqudity"),
            forward_ton_amount: tonAmount,
            forward_payload: cell("removeLiqudity"),
        }
    );

    await provider.waitForDeploy(lpWallet.address);

    // run methods on `exchange`
}

function cell(pram: string) {
    return beginCell().storeBit(1).storeUint(0, 32).storeStringTail(pram).endCell();
}