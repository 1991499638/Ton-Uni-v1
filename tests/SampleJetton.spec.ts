import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, toNano, beginCell } from '@ton/core';
import { SampleJetton } from '../wrappers/SampleJetton';
// import { JettonDefaultWallet as JettonWallet } from '../wrappers/Jetton';
import { JettonDefaultWallet as JettonWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';
import '@ton/test-utils';
import { send } from 'process';
import { buildOnchainMetadata } from "../utils/jetton-helpers";

const jettonParams = {
    name: "Live2",
    description: "This is the first jetton from live2",
    symbol: "Li2",
    image: "https://avatars.githubusercontent.com/u/115602512?s=96&v=4",
};

describe('SampleJetton', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let sampleJetton: SandboxContract<SampleJetton>;
    let jettonWallet: SandboxContract<JettonWallet>;
    let user: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
    
        // Create content Cell
        let content = buildOnchainMetadata(jettonParams);
        let max_supply = toNano(123456766689011);

        deployer = await blockchain.treasury('deployer');
        user = await blockchain.treasury('user');
        sampleJetton = blockchain.openContract(await SampleJetton.fromInit(deployer.address, content, max_supply));

        const deployResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sampleJetton.address,
            deploy: true,
            success: true,
        });

    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and SampleJetton are ready to use
    });

    it('should mint', async () => {
        const amount = toNano('1234');
        const mintResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: amount,
            },
            {
                $$type: 'Mint',
                amount: amount,
                receiver: deployer.address,
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sampleJetton.address,
            value: amount,
            success: true,
        });

        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        let balance = await jettonWallet.getGetWalletData();
        console.log("balance", balance.balance);    

        await jettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.3'),
            },
            {
                $$type: "TokenTransfer",
                queryId: 1n,
                amount: toNano('7'),
                destination: user.address,
                response_destination: deployer.address,
                custom_payload: cell("Mint"),
                forward_ton_amount: toNano('0.1'),
                forward_payload: cell("Mint"),
            }
        );

        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        balance = await jettonWallet.getGetWalletData();
        console.log("balance", balance.balance);  

        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, user.address));
        balance = await jettonWallet.getGetWalletData();
        console.log("balance", balance.balance);  
    });
});
function cell(pram: string) {
    return beginCell().storeUint(0, 32).storeStringTail(pram).endCell();
}