import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, toNano, beginCell, Dictionary, fromNano } from '@ton/core';
import { SampleJetton } from '../build/SampleJetton/tact_SampleJetton';
import { JettonDefaultWallet as JettonWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';
import { redEnvelope as RedEnvelope, EnvelopeInfo } from '../build/RedEnvelope/tact_redEnvelope';
import '@ton/test-utils';
import { send } from 'process';
import { buildOnchainMetadata } from "../utils/jetton-helpers";
import exp from 'constants';
import { before } from 'node:test';

const jettonParams = {
    name: "Live2",
    description: "This is the first jetton from live2",
    symbol: "Li2",
    image: "https://avatars.githubusercontent.com/u/115602512?s=96&v=4",
};

describe('RedEnvelope', () => {
    // 保存原始的console.log函数
    const originalLog = console.log;

    // 自定义一个新的console.log函数
    console.log = (...args) => {
        process.stdout.write(args.join(' ') + '\n');
    };

    // 在你的测试结束后，恢复原始的console.log函数
    afterAll(() => {
        console.log = originalLog;
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let sampleJetton: SandboxContract<SampleJetton>;
    let redEnvelope: SandboxContract<RedEnvelope>;
    let jettonWallet: SandboxContract<JettonWallet>;
    let user: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        // ----------------- Deploy SampleJetton -----------------
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


        // ----------------- Deploy RedEnvelope -----------------
        let initAmount = 100;
        let initSize = 10;

        const keyType = Dictionary.Keys.Address();
        const valueType = Dictionary.Values.Bool();

        let initLists = Dictionary.empty(keyType, valueType);
        initLists.set(deployer.address, true);
        let initEnvelopeInfo: EnvelopeInfo = {
            $$type: 'EnvelopeInfo',
            jetton: deployer.address,
            MyJettonWallet: deployer.address,
            content: content,
            queryId: 0n,
            min: 0n,
        };   

        redEnvelope = blockchain.openContract(await RedEnvelope.fromInit(toNano(initAmount), BigInt(initSize), initEnvelopeInfo, BigInt(0)));
        const redEnvelopeResult = await redEnvelope.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(redEnvelopeResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: redEnvelope.address,
            deploy: true,
            success: true,
        });

        // ----------------- SetMyJettonWallet -----------------
        let redJettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, redEnvelope.address));
        // console.log("redJettonWallet", redJettonWallet.address);
        let setResult = await redEnvelope.send(
            deployer.getSender(),
            {
                value: toNano('5'),
            },
            {
                $$type: 'SetMyJettonWallet',
                wallet: redJettonWallet.address,
            }
        );

        expect(setResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: redEnvelope.address,
            success: true,
        });
        // let wallet = await redEnvelope.getMyJettonWallet();
        // console.log("wallet", wallet);
        // expect(wallet).toEqual(redJettonWallet.address);

        // ----------------- Mint -----------------
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
        console.log("deployer balance", fromNano(balance.balance));    

        // ----------------- transfer Jetton to envelope -----------------
        await jettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.3'),
            },
            {
                $$type: "TokenTransfer",
                queryId: 1n,
                amount: toNano(initAmount),
                destination: redEnvelope.address,
                response_destination: deployer.address,
                custom_payload: cell("Mint"),
                forward_ton_amount: toNano('0.1'),
                forward_payload: cell("Mint"),
            }
        );

        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        balance = await jettonWallet.getGetWalletData();
        let before_deployer = fromNano(balance.balance);
        console.log("deployer balance", fromNano(balance.balance));  

        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, redEnvelope.address));
        balance = await jettonWallet.getGetWalletData();
        let before_red = fromNano(balance.balance);
        console.log("red balance", fromNano(balance.balance)); 
    });

    it('should deploy', async () => {
        
    });

    it('should test send', async () => {

        // ----------------- send Token -----------------
        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        let balance = await jettonWallet.getGetWalletData();
        let before_deployer = fromNano(balance.balance);

        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, redEnvelope.address));
        balance = await jettonWallet.getGetWalletData();
        let before_red = fromNano(balance.balance);

        let amount = 7;
        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, redEnvelope.address));
        let sendResult = await redEnvelope.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'SendToken',
                to: deployer.address,
                amount: toNano(amount),
                queryId: 2n,
                value: toNano('0.1'),
            }
        );
        // console.log("Ton balance ", fromNano(await deployer.getBalance()));
        expect(sendResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: redEnvelope.address,
            success: true,
        });
        
        balance = await jettonWallet.getGetWalletData();
        expect(BigInt(fromNano(balance.balance))).toEqual(BigInt(before_red) - BigInt(amount));
        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        balance = await jettonWallet.getGetWalletData();
        expect(BigInt(fromNano(balance.balance))).toEqual(BigInt(before_deployer) + BigInt(amount));
    });


    it('should test newRund', async () => {
        let amount = 1000;
        let min = 50;
        let size = 10;
        let round = size;
        let avg = amount / size;
        let total = 0;
        console.log('-----------------redInfo-----------------');
        for (let i = 0; i < round; i++) {
            let redInfo = await redEnvelope.getRund(toNano(amount), toNano(min), BigInt(size));
            console.log(`redInfo ${i + 1}: `, fromNano(redInfo));
            amount -= Number(fromNano(redInfo));
            size--;
            console.log('total', total += Number(fromNano(redInfo)));
        }
        // let redInfo = await redEnvelope.getNewRund(BigInt(amount), BigInt(min), BigInt(size));
        
        // console.log("redInfo", redInfo);
        console.log('avg', avg);
    });
    
    it.only('should send redEnvelope', async () => {

        console.log(`\n-----------------send redEnvelope-----------------`);
        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        let balance = await jettonWallet.getGetWalletData();
        let before_deployer = fromNano(balance.balance);

        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, redEnvelope.address));
        balance = await jettonWallet.getGetWalletData();
        let before_red = fromNano(balance.balance);

        let to = deployer.address;
        let sendEnvelopeResult = await redEnvelope.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'GetEnvelope',
                to: to,
                queryId: 3n,
            }
        );

        expect(sendEnvelopeResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: redEnvelope.address,
            success: true,
        });

        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        balance = await jettonWallet.getGetWalletData();
        let after_deployer = fromNano(balance.balance);
        console.log("deployer balance", fromNano(balance.balance));

        jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, redEnvelope.address));
        balance = await jettonWallet.getGetWalletData();
        let after_red = fromNano(balance.balance);
        console.log("red balance", fromNano(balance.balance));

        let before = Number(before_deployer) + Number(before_red);
        let after = Number(after_deployer) + Number(after_red);
        console.log("before", before);
        console.log("after", after);

        let diff = Number(before_red) - Number(after_red);
        console.log("diff", diff);

        let amount = await redEnvelope.getAmount();
        console.log("amount", fromNano(amount));
        let size = await redEnvelope.getSize();
        console.log("size", size);

        let flag = await redEnvelope.getFlag();
        console.log("flag", flag);

        // ----------------- send remain -----------------
        let round = 9;
        for (let i = 0; i < round; i++) {
            console.log(`\n-----------------send remain ${i+1}-----------------`);
            jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
            balance = await jettonWallet.getGetWalletData();
            before_deployer = fromNano(balance.balance);
    
            jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, redEnvelope.address));
            balance = await jettonWallet.getGetWalletData();
            before_red = fromNano(balance.balance);
            let to = user.address;
            let sendEnvelopeResult = await redEnvelope.send(
                deployer.getSender(),
                {
                    value: toNano('0.1'),
                },
                {
                    $$type: 'GetEnvelope',
                    to: to,
                    queryId: 3n,
                }
            );
    
            expect(sendEnvelopeResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: redEnvelope.address,
                success: true,
            });

            jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
            balance = await jettonWallet.getGetWalletData();
            let after_deployer = fromNano(balance.balance);
            console.log(`deployer balance${i+2}: `, fromNano(balance.balance));
    
            jettonWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, redEnvelope.address));
            balance = await jettonWallet.getGetWalletData();
            let after_red = fromNano(balance.balance);
            console.log(`red balance ${i + 2}: `, fromNano(balance.balance));
    
            // let after = Number(after_deployer) + Number(after_red);
            // console.log(`after ${i+2}: `, after);
            let diff = Number(before_red) - Number(after_red);
            console.log(`diff ${i+2}: `, diff);

            let amount = await redEnvelope.getAmount();
            console.log("amount", fromNano(amount));
            let size = await redEnvelope.getSize();
            console.log("size", size);
            
        }
    });
});

function cell(pram: string) {
    return beginCell().storeUint(0, 32).storeStringTail(pram).endCell();
}