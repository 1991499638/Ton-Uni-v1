import { toNano, Address, beginCell,  } from '@ton/core';
import { main } from '../wrappers/Exchange';
import { JettonDefaultWallet } from '../wrappers/DefaultWallet';
import { NetworkProvider } from '@ton/blueprint';
import { buildOnchainMetadata } from "../utils/jetton-helpers";

export async function run(provider: NetworkProvider) {
    const jetton = Address.parse("EQAMkP-Vtx-i_txjPRkY9ZpL8BCDXOzcIhxOwwU2ae9FfzKk");
    const to = Address.parse("0QBnGj-Xo7SDLl0lFKuNg9sE-d17K5UVciZzYThwii3lA1tE");
    const user = provider.sender().address as Address;
    // const exchange = provider.open(await main.fromInit(jetton, user));
    const jettonWallet = provider.open(await JettonDefaultWallet.fromInit(jetton, user));
    
    await jettonWallet.send(
        provider.sender(),
        {
            value: toNano('0.5'),
        },
        {
            $$type: "TokenTransfer",
            queryId: 1n,
            amount: toNano('7'),
            destination: to,
            response_destination: user,
            custom_payload: cell("transfer"),
            forward_ton_amount: toNano('0.2'),
            forward_payload: cell("transfer"),
        }
    );

    await provider.waitForDeploy(jettonWallet.address);

    // run methods on `exchange`
}

function cell(pram: string) {
    return beginCell().storeBit(1).storeUint(0, 32).storeStringTail(pram).endCell();
}