import { toNano, Address, beginCell,  } from '@ton/core';
import { main } from '../wrappers/Exchange';
import { JettonDefaultWallet } from '../wrappers/DefaultWallet';
import { NetworkProvider, tonDeepLink } from '@ton/blueprint';
import { buildOnchainMetadata } from "../utils/jetton-helpers";

export async function run(provider: NetworkProvider) {
    const jetton = Address.parse("EQAMkP-Vtx-i_txjPRkY9ZpL8BCDXOzcIhxOwwU2ae9FfzKk");
    const user = provider.sender().address as Address;
    const exchange = provider.open(await main.fromInit(jetton, user));
    // const jettonWallet = provider.open(await JettonDefaultWallet.fromInit(jetton, user));
    
    await exchange.send(
        provider.sender(),
        {
            value: toNano('0.5'),
            bounce: true,
        },
        {
            $$type: "TokenNotification",
            queryId: 1n,
            amount: toNano('5'),
            from: user,
            forward_payload: cell(""),
        }
    );

    await provider.waitForDeploy(exchange.address);

    // run methods on `exchange`
}

function cell(pram: string) {
    return beginCell().storeBit(1).storeUint(0, 32).storeStringTail(pram).endCell();
}